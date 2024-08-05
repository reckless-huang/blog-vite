---
title: 这个博客是怎么搭建的
isOriginal: true
author: 宇峰
date: 2024/08/02 22:25
articleTitle: 这个博客是怎么搭建的
categories:
 - others
tags:
 - blog
 - cloudflare
 - github
 - vitepress
 - cdn
---

### 为什么选择vitepress
* 区别于传统的b/s架构，vuepress，vitepress部署更简单，使用更方便，**即刻开始**不给自己任何借口。
* vitepress是vuepress的升级版，同时也是vue3doc的底座，我个人技术栈中有vue3，所以选择vitepress，另外我也推荐您使用vitepress，他的生态更好，社区更活跃。
### 如何开始搭建
1. 浏览官方文档[vitepress](https://vitepress.dev/zh/guide/getting-started)
2. 本地跑起来，看看效果
```shell
# 安装node（需要18.0以上版本）
# 安装vitepress
npm install pnpm -g
pnpm config set registry https://registry.npmmirror.com/
pnpm add -D vitepress
# 初始化项目
pnpm vitepress init
# 运行
pnpm run docs:dev
```
3. 上面是官网的方式，了解过后我更推荐您使用一些社区的模板，我使用的是[charles7c](https://github.com/Charles7c/charles7c.github.io),一个很棒的模板，您可以直接fork过来，然后修改成自己的博客。
4. 部署到github pages
5. 使用cloudflare加速
### 遇到的问题
- **githubaction授权**
![githubaction.png](https://blog.gostatus.cn/img/githubaction.png)
- **内容乱码**
文件编码不是utf8
- **base路径**
如果您有多个仓库都开启了pages，那么您需要设置base路径，base: '/mywebsite/',但是如果page绑定了自定义域名则不需要设置base路径。
- **ssl加密错误**
配合cloudflare使用，建议设置flexible，同时github上不配置强制https
- **unpublish后如何恢复**
[参考这个文档](https://blog.csdn.net/weixin_46143152/article/details/129046623)
- **调整workflow**
- **排查缓存问题**
1. 关闭cloudflare缓存，查看是否是cloudflare缓存导致的问题
2. 本地清除缓存，查看是否是本地缓存导致的问题
### 如果想有一个博客，那就现在开始吧，有疑问欢迎留言。
