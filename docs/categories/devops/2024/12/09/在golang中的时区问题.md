---
title: "golang中的时区问题"
date: 2024-12-09 22:46:00
author: yufeng
isTop: true
origin: true
categories:
   - devops
tags:
   - golang
   - 时区问题
---
# golang中的时区问题
在go开发过程中时间处理往往和时区相关，如果你发现你的数据和期望数据相差8小时，那么恭喜你踩到时区的坑了
## 排查方向
- 数据库时区
- 代码本地时区
- 序列化和反序列化时区
- orm映射
### 数据库时区
使用以下命令确认数据库时区是否正常
```sql
SHOW VARIABLES LIKE 'time_zone';
select now()
```
or
```go
	var res map[string]interface{}
	mydb.Raw("select now()").Find(&res)
	fmt.Printf("数据库时间%v", res)
```
如果时间不对，或者时区不对，那么可以修改数据库的时区，使用以下命令临时修改，最好通过配置文件修改哈！！！
```sql
SET GLOBAL time_zone = '+8:00';
```
### 代码本地时区
直接使用code查看
```go
fmt.Println(time.Now())
fmt.Println(time.Now().Location())
```
如果时间不对，那么可以设置环境变量
```shell
export TZ=Asia/Shanghai
```
### 序列化和反序列化时区
如果你有自定义反序列化的设计，那你需要注意使用time.ParseInLocation 而不是 time.Parse
```go
	now, err := time.ParseInLocation(`"`+SecLocalTimeFormat+`"`, string(data), time.Local)
```
### orm映射
如果使用了gorm自定义类型，那么在scan和value时也有可能出现时区问题
### 使用raw和exec验证
使用raw和exec验证是否是db交互层的问题
```go
	mydb.Exec("INSERT INTO `easycloud`.`duty_event` (`created_at`, `updated_at`, `deleted_at`, `start_time`, `end_time`, `rule_id`, `team_name`, `describe`) VALUES ( '2024-12-09 20:56:02.343', '2024-12-09 20:56:02.343', NULL, '2025-01-05 17:00:00.000', '2025-01-06 05:00:00.000', 16, 'aaa', 'awdaw-aaa');")
	var s map[string]interface{}
	mydb.Raw("select * from `easycloud`.`duty_event` order by id desc limit 1").Find(&s)
	fmt.Printf("aaaaaa%v", s)
```
如果正常则一般问题出在提交db之前！！！
## 复盘
That's all, happy hacking!  :whale: