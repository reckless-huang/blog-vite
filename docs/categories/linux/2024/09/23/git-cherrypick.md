---
title: git cherry-pick
date: 2024-09-23
categories:
  - linux
tags:
  - linux
  - git
---
# IDEA Git Cherry-Pick（摘樱桃） 实现分支的部分提交合并到dev
Git Cherry-pick，通常叫做摘樱桃。此为Git 的一种操作，作用是将部分代码从一个分支转移到另一个分支。
## 使用场景
一般情况下，我们采用的是 git merge的方式来合并两个分支的代码。这种情况，适用于我们需要另一个分支的所有代码变动（包含创建分支前的base代码）。

另一种情况是，你只需要部分代码变动（某几个提交），那么就可以采用 Cherry pick。

## 实际操作
1. 首先，我们需要切换到需要合并代码的分支，例如我们需要将feature分支的某个提交合并到dev分支。
```shell
git checkout dev
```
2. 然后，我们需要找到需要合并的提交的commit id，可以通过git log查看。
```shell
git log
```
3. 最后，我们执行git cherry-pick命令，将feature分支的某个提交合并到dev分支。
```shell
git cherry-pick commit_id
```
实际上我们可以使用ide，直接右键需要合并的commit选择**优选（cherry-pick的翻译）**，即可完成操作。   
:neutral_face: CDN没好，后续会补充图片
