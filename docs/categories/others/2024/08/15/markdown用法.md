---
title: markdown用法
date: 2024-08-15 00:00:00
categories: 
  - others
tags:
  - markdown
---
# 记录一些markdown用法
- 1 tip
::: tip 笔者说
这里的内容会独立的展示
:::
- 2 引用

> 和上面的效果类似   
> do something   
> 和上面的效果类似

- 3 换行   
在一行的末尾添加两个或多个空格，然后按回车键,即可创建一个换行

- 4 表格

- 5 甘特图
```mermaid
        gantt
        dateFormat  YYYY-MM-DD
        title 软件开发甘特图
        section 设计
        需求                      :done,    des1, 2014-01-06,2014-01-08
        原型                      :active,  des2, 2014-01-09, 3d
        UI设计                     :         des3, after des2, 5d
    未来任务                     :         des4, after des3, 5d
        section 开发
        学习准备理解需求                      :crit, done, 2014-01-06,24h
        设计框架                             :crit, done, after des2, 2d
        开发                                 :crit, active, 3d
        未来任务                              :crit, 5d
        耍                                   :2d
        section 测试
        功能测试                              :active, a1, after des3, 3d
        压力测试                               :after a1  , 20h
        测试报告                               : 48h
```
- 6 UML时序图
```mermaid
  sequenceDiagram
    participant 张三
    participant 李四
    张三->王五: 王五你好吗？
    loop 健康检查
        王五->王五: 与疾病战斗
    end
    Note right of 王五: 合理 食物 <br/>看医生...
    李四-->>张三: 很好!
    王五->李四: 你怎么样?
    李四-->王五: 很好!
```
- 7 竖向流程图
```mermaid
graph TD
A[方形] --> B(圆角)
    B --> C{条件a}
    C --> |a=1| D[结果1]
    C --> |a=2| E[结果2]
    F[竖向流程图]
```
- 8 横向流程图
```mermaid
graph LR
A[方形] -->B(圆角)
    B --> C{条件a}
    C -->|a=1| D[结果1]
    C -->|a=2| E[结果2]
    F[横向流程图]
```
- 9 表格
  |  表头   | 表头  |
  |  ----  | ----  |
  | 单元格  | 单元格 |
  | 单元格  | 单元格 |
- 10 表格对齐
  | 向左对齐 | 居中 | 向右对齐 |
  | :--- | :---: | ---: |
  | 单元格 | 单元格 | 单元格 |
  | 单元格 | 单元格 | 单元格 |
- 11 imoji表情    
  :smile: :laughing: :blush:
# 参考文章
- [markdown官方教程](https://markdown.com.cn/)
- [ljy的博客](https://www.cnblogs.com/luyj00436/p/15070274.html)
- [大量表情](https://gist.github.com/rxaviers/7360908)