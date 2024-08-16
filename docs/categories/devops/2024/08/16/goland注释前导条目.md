---
title: GoLand注释前导条目
isOriginal: true
author: 宇峰
date: 2024/08/16 22:25
categories:
  - devops
tags:
  - goland
  - go
  - 注释
---
# goland提示注释需要的前导条目
每次写代码的时候，我们都会写一些注释，但是在GoLand中，我们写注释的时候，总是提示我们需要一个前导条目，这是为什么呢？
## 原因
https://golang.org/doc/effective_go#commentary

Effective Go 里解释了有什么用，简单说就是为了方便 go doc | grep 一眼看出名字和注释的关系，这样就能快速找到想要的信息。  

这真的是让人痛苦呀，搜索函数时总是要多看一行。

但这是Go的规范，我们还是要遵守的。