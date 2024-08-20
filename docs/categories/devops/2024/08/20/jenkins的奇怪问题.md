---
title: Jenkins的奇怪问题
isOriginal: true
author: 宇峰
date: 2024/08/20 22:25
categories:
  - devops
tags:
  - Jenkins
  - Git
  - CI/CD
---
# 记录一个工作上遇到的jenkins问题
白天刚上班突然有同事质疑我们的ci是不是使用了错误的commitid，并给我展示如下日志
```
16:55:56 Avoid second fetch
16:55:56  > git rev-parse origin/testing2.8^{commit} # timeout=10
16:55:56 Checking out Revision e803c8acfda2fbb25deeddb1f411989f9667703a (origin/testing2.8)
16:55:57  > git config core.sparsecheckout # timeout=10
16:55:57  > git checkout -f e803c8acfda2fbb25deeddb1f411989f9667703a # timeout=10
16:56:03 Commit message: "Merge branch 'feat' into testing2.8"
16:56:03  > git rev-list --no-walk f0c02af3ac0298261661ef9064d7423e98b80ab1 # timeout=10
```
说看jenkins的输出最后使用的commitid不对，这会让他有代码没正常上线，第一时间我也有点懵，但是看了历史记录一直有类似情况的,而且基本看了下rev-list是获取父提交基本不会有啥问题，所以答复开发同学这是正常日志   
**但是我还是想弄清楚为什么Jenkins打印了这么多次commitid**
## 开始排查
首先从白屏页面上看了jenkins的源码管理，并没有特殊的配置，那只能看源码实现了，但是jenkins是java很难受，我python go 都还不错，java是真的没花过时间，不过看看逻辑应该问题不大。  
先找到仓库，大概看了下结构，应该是[SCM](https://github.com/jenkinsci/jenkins/tree/master/core/src/main/java/hudson/scm)这里写了主要的逻辑，However，这里的代码都已经@Deprecated了,en~~~头大:disappointed_relieved:      
回到主仓库看到有很多plugin项目，突然想起来jenkins是插件化的，因此代码在这里[git-plugin](https://github.com/jenkinsci/git-plugin)接下来就是顺着日志一顿找了，先看这种日志   
**Commit message**   
按照开发习惯基本都是可以在代码中检索的，这里要说sourcegraph的搜索功能真的好用，直接搜索`Commit message`，找到了这个类[GitSCM.java](https://sourcegraph.com/github.com/jenkinsci/git-plugin@d57b398efbfc3e84cd4ccd7bd5ef5560eafbeced/-/blob/src/main/java/hudson/plugins/git/GitSCM.java?L1424)  
但是这里都在checkout的逻辑中，好像有点没思路了，下面的代码都是条件判断且没有符合的日志。     
有点迷茫，对比一下其他的job，发现个不一样的日志  
**First time build. Skipping changelog**    
拿来搜一下，发现新大陆了，基本确定就是这个函数了[computeChangeLog](https://sourcegraph.com/github.com/jenkinsci/git-plugin@d57b398efbfc3e84cd4ccd7bd5ef5560eafbeced/-/blob/src/main/java/hudson/plugins/git/GitSCM.java?L1502)   
往上看computeChangeLog 的注释，在存在分支合并时会检查合并分支的提交信息，所以父id被拿出来git vet-list也正常了，破案:smile:
## END
这个问题也是我工作中遇到的一个小问题，但是也是我第一次深入了解jenkins的源码，虽然没看懂，但是也算是有了一些了解，希望以后能够更好的解决问题。  
sourcegraph真的好用，推荐给大家