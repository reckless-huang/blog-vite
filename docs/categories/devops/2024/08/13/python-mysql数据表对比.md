---
title: Python MySQL数据表对比
isOriginal: true
author: 宇峰
date: 2024/08/13 22:25
categories:
  - devops
tags:
  - python
  - mysql
---
# python 实现mysql数据表对比
在发布过程中需要同步配置表到线上，但是线上的表和本地的表可能会有差异，这时候就需要对比两个表的差异，这里记录一下python实现mysql数据表对比的方法。
## 主要思路
**快照数据** 快照标准环境的表数据

**对比数据** 和线上环境的表数据对比
## 代码实现
直接贴代码
### 快照数据
```python
    '''
    快照数据
    '''
    @classmethod
    def get_project_data(cls, project: Project, tablecanbenone=False):
        dbclient = project.get_db_con(configtype='client')
        data = {}
        for key in cls.TABLEMAP.keys():
            tablename = cls.TABLEMAP[key].get('fullname', None) or key
            try:
                cursor = dbclient.get_connection().cursor()
                cursor.execute(f'select *  from {tablename}')
                values = list(cursor.fetchall())
                cursor.execute(f'SHOW FULL COLUMNS FROM {tablename}')
                columns = list(cursor.fetchall())
                column = [i[0] for i in columns]
                # 动态创建 NamedTuple 类
                from collections import namedtuple
                TableRow = namedtuple('TableRow', column)

                # 将数据转换为 NamedTuple
                table_data = [TableRow(*row) for row in values]
                # df = pd.DataFrame(values, columns=column, dtype='object')
                namedtuple_dict = cls.namedtyple_to_dict(table_data)
                data[key] = namedtuple_dict
            except Exception as e:
                if str(e) == f'Table {tablename} not found' and tablecanbenone:
                    continue
                else:
                    raise e
        return json.dumps(data, default=cls.custom_json_serializer).encode('utf-8')
        
    '''
    补充nan的判断
    '''    
    @staticmethod
    def is_nan(value):
        if value:
            return False
        else:
            if value == 0:
                return False
            return True
            
    '''
    将namedtuple转换为dict
    '''        
    @staticmethod
    def namedtyple_to_dict(namedtuple_list):
        return [item._asdict() for item in namedtuple_list]

    '''
    自定义json序列化器
    '''
    @staticmethod
    def custom_json_serializer(obj):
        from datetime import datetime, date
        if isinstance(obj, (datetime, date)):
            time_format = '%Y-%m-%d %H:%M:%S' if isinstance(obj, datetime) else '%Y-%m-%d'
            return obj.strftime(time_format)
        if isinstance(obj, bytes):
            # 将bytes转换为可序列化的格式，例如十六进制字符串
            return obj.hex()
        else:
            raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable by custom handler")
```
### 对比数据
```python
    @classmethod
    def getdml(cls, olddata, newdata) -> str:
        if olddata is None:
            # 所有数据都是新增数据，生成 INSERT 语句
            new_data = json.loads(newdata)
            dml_statements = []
            for sheetname, dfnew in new_data.items():
                dfnew = pd.read_json(dfnew)
                try:
                    table_name = cls.TABLEMAP[sheetname].get('fullname', None) or sheetname
                except Exception as e:
                    continue
                for _, row_new in enumerate(dfnew):
                    insert_values = ', '.join(
                        [f"{cls.escape_value(value)}" if (not cls.is_nan(value)) else 'NULL' for value in
                         row_new.values()])
                    insert_sql = f"INSERT INTO {table_name} VALUES ({insert_values})"
                    dml_statements.append(insert_sql)
            return ';\n'.join(dml_statements)
        else:
            dfold_data = json.loads(olddata)
            try:
                dfnew_data = json.loads(newdata)
            except Exception as e:
                print(str(e))
                dfnew_data = pd.read_excel(newdata, sheet_name=None)
            # 执行比对逻辑，生成 DML 语句
            dml_statements = []

            for sheetname, dfnew in dfnew_data.items():
                dfold = dfold_data.get(sheetname)  # 获取对应表的老数据
                if dfold is None:
                    for index, row_new in enumerate(dfnew):
                        insert_values = ', '.join(
                            [f"{cls.escape_value(value)}" if (not cls.is_nan(value)) else 'NULL' for value in
                             row_new.values]
                        )
                        insert_sql = f"INSERT INTO {table_name} VALUES ({insert_values})"
                        dml_statements.append(insert_sql)
                else:
                    primary_key_col = cls.TABLEMAP[sheetname].get('index')

                    for index, row_new in enumerate(dfnew):
                        id_value = row_new[primary_key_col]


                        # 检查新的快照中是否存在主键对应的行
                        row_old = list(filter(lambda x: x[primary_key_col] == id_value, dfold))

                        if not row_old:  # 新增数据，生成 INSERT 语句
                            insert_values = ', '.join(
                                [f"{cls.escape_value(value)}" if (not cls.is_nan(value)) else 'NULL' for value in
                                 row_new.values()]
                            )
                            insert_sql = f"INSERT INTO {table_name} VALUES ({insert_values})"
                            dml_statements.append(insert_sql)
                        else:  # 主键已存在，比对字段差异
                            row_old = row_old[0]
                            has_difference = False
                            update_values = []  # 用于存储需要更新的字段和值
                            checkfields = cls.TABLEMAP[sheetname].get('checkfields', [])
                            ignorefields = cls.TABLEMAP[sheetname].get('ignorefields', [])

                            for col in row_new.keys():
                                if (checkfields and col not in checkfields) or (
                                        not checkfields and ignorefields and col in ignorefields):
                                    continue
                                if cls.is_nan(row_new[col]) and cls.is_nan(row_old[col]):
                                    continue
                                if (col not in row_old.keys()) or (row_new[col] != row_old[col]):
                                    has_difference = True
                                    update_values.append(
                                        f"{col} = {cls.escape_value(row_new[col])}" if (
                                            not cls.is_nan(row_new[col])) else
                                        f"{col} = NULL")

                            if has_difference:
                                update_values_str = ', '.join(update_values)
                                update_sql = f"UPDATE {table_name} SET {update_values_str} WHERE {primary_key_col} = '{id_value}'"
                                dml_statements.append(update_sql)

                    # 检查老的快照中是否存在主键对应的行，如果不存在则生成 DELETE 语句
                    for index, row_old in enumerate(dfold):
                        id_value = row_old[primary_key_col]

                        # 检查新的快照中是否存在主键对应的行
                        row_new = list(filter(lambda x: x[primary_key_col] == id_value, dfnew))

                        if not row_new:  # 删除数据，生成 DELETE 语句
                            delete_sql = f"DELETE FROM {table_name} WHERE {primary_key_col} = '{id_value}'"
                            dml_statements.append(delete_sql)
            return ';\n'.join(dml_statements)
```
## 开发设计
数据结构和比对思路
### 数据结构
使用什么样的数据结构来描述一张mysql数据表的数据呢？

首先可以明确的是他需要一个二维的信息，同时有列名和列值。
- pandas
pandas的DataFrame是一个很好的选择，但是DataFrame是一个比较重的数据结构，
同时实测pandas在大数据的情况下会有精度丢失的问题，最开始我们的方案就是用的DataFrame，
后面发现UUID的同步出现了问题，精度丢失导致了UUID的变化。
- namedtuple
在Python中，NamedTuple是一种特殊形式的元组，它为元组内的每个元素赋予了名字，从而使得访问更加直观且代码更具自解释性。
这种数据结构结合了元组的不可变性和字典的键值对应特性，非常适合用来表示具有固定属性的小型对象集合，比如数据库查询结果、配置项等。

TableRow = namedtuple('TableRow', column) 动态创建NamedTuple类
- dataclass
dataclass是python3.7新增的一个装饰器，用于简化类的定义，可以自动添加__init__、__repr__等方法。
dataclass的使用方法和namedtuple类似，但是dataclass更加灵活，可以定义更多的方法和属性。

### 比对思路
- 表级别对比，不存在的表全部增加insert语句
- 行级别对比，对比每一行的数据，如果不存在则增加insert语句，如果存在则对比字段，如果字段不同则增加update语句

### 优化
现在对空值的处理不够好

