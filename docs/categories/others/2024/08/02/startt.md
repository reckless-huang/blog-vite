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
1. 浏览官方文档[vitepress](../../../../../public/img/githubaction.png)
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
```yaml
# 构建 VitePress 站点并将其部署到 GitHub Pages 的示例工作流程
#
name: Deploy VitePress site to Pages

on:
  # 在针对 `main` 分支的推送上运行。如果你
  # 使用 `master` 分支作为默认分支，请将其更改为 `master`
  push:
    branches: [master]

  # 允许你从 Actions 选项卡手动运行此工作流程
  workflow_dispatch:

# 设置 GITHUB_TOKEN 的权限，以允许部署到 GitHub Pages
permissions:
  contents: read
  pages: write
  id-token: write

# 只允许同时进行一次部署，跳过正在运行和最新队列之间的运行队列
# 但是，不要取消正在进行的运行，因为我们希望允许这些生产部署完成
concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  # 构建工作
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # 如果未启用 lastUpdated，则不需要
      - name: Setup PNPM
        uses: pnpm/action-setup@v2
        with:
          version: latest
      # - uses: oven-sh/setup-bun@v1 # 如果使用 Bun，请取消注释
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm # 或 pnpm / yarn
      - name: Setup Pages
        uses: actions/configure-pages@v4
      - name: Install dependencies
        run: pnpm i --frozen-lockfile
      - name: Build with VitePress
        run: pnpm build
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: docs/.vitepress/dist

  # 部署工作
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    needs: build
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```
- **排查缓存问题**
1. 关闭cloudflare缓存，查看是否是cloudflare缓存导致的问题
2. 本地清除缓存，查看是否是本地缓存导致的问题
3. lean.js(优化的js不包含内容所以导致页面内容空) 最终导致了这个问题，但是我没有找到解决办法，只能等待他们修复。
### 如果想有一个博客，那就现在开始吧，有疑问欢迎留言。
### 参考资料（侵删）
1. [vitepress官方文档](https://vitepress.dev/zh/guide/getting-started)
2. [charles7c](https://github.com/Charles7c/charles7c.github.io)
3. [恢复unpublish的文章](https://blog.csdn.net/weixin_46143152/article/details/129046623)
4. [gitcus](https://qiuliw.github.io/categories/issues/2024/6/19/vitepress%E5%90%AF%E7%94%A8giscus)
