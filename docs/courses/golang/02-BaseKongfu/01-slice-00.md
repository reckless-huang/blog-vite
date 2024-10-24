---
title: slice[0:0]
date: 2024-10-24 00:00:00
author: 宇峰
categories: 
  - golang
tags:
  - slice
---
# slice[0:0]
## 故事的开始是一道题
```go
package main

import "fmt"

func main() {
	fmt.Println("Hello, 世界")
	var a = []int{1, 2, 3}
	b := a[0:len(a)]
	a = a[0:0]
	a = append(a, 4)
	fmt.Printf("%+v\n", a)
	fmt.Printf("%+v\n", b)
}
```
那么它的答案是什么呢？
## 我们在go游乐场看看：
- https://go.dev/play/
- https://goplay.tools/   
我更推荐tool，更加现代化   
## 解析
```go
Hello, 世界
[4]
[4 2 3]
```
答案是不是有点超乎意外，这个题目中涉及到slice在go中是如何表示的    
总所周知slice是一个结构体，它包含了一个指向数组的指针，一个长度，一个容量，这里首先创建了一个slice a，然后创建了一个slice b，b是a的一个切片，
需要注意的是b,a的底层数组是同一个，然后a = a[0:0]，这里的操作是将a的长度设置为0，最后append一个元素4，这里的append操作是在a的底层数组上进行的，
而此时底层数组下标为0，因为底层数组的0位置被4覆盖。   
上面是题解，中间a = a[0:0]也是一个不那么常见的操作，虽然你可能在开源库中见过类似的代码，比如[gin](https://github.com/gin-gonic/gin/blob/f05f966a0824b1d302ee556183e2579c91954266/context.go#L98)
```go
func (c *Context) reset() {
	c.Writer = &c.writermem
	c.Params = c.Params[:0]
	c.handlers = nil
	c.index = -1

	c.fullPath = ""
	c.Keys = nil
	c.Errors = c.Errors[:0]
	c.Accepted = nil
	c.queryCache = nil
	c.formCache = nil
	c.sameSite = 0
	*c.params = (*c.params)[:0]
	*c.skippedNodes = (*c.skippedNodes)[:0]
}
```
## 回顾一下总共有三种方法可以清空slice
```go
a = a[:0]
a = nil
a = []any{}
```
- nil方式会导致需要重新分配底层数组，同时原有的底层数组需要等待GC回收    
- []any{}方式会导致长度和容量都归0，后续append会触发扩容
- [:0]方式会导致长度归0， 底层数组不变后续append会在原有数组上进行操作，同时语义上更加明确