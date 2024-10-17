---
title: helm charts管理
date: 2024-10-17 00:00:00
categories: 
  - devops
tags:
  - helm
  - jenkins
  - nexus
  - gitops
---
# helm仓库管理
私有化部署会有中间件，比如rabbitmq, redis, mysql, xxljob等，这些中间件的部署和管理是一个问题，helm是一个很好的解决方案，我们可以通过helm来管理这些中间件的部署，升级，回滚等操作。   
对接到运维平台上，只需要维护对应的helm仓库地址即可。但是长久下来运维平台的代码中保存了很多charts，更新一个中间件的chart就需要更新所有的运维平台代码，这样不太好，我们可以通过jenkins+nexus独立出一个helm仓库管理的流程。
## 实现方案
使用类似gitops的方式，通过git管理helm仓库的chart，每次变更通过webhook触发jenkins流程，jenkins完成chart的打包，上传到nexus。
### 准备nexus-push
为什么是nexus而不是harbor，主要是因为Maven，npm， docker已经在nexus上了，我们只需要在nexus上创建一个新的仓库即可。但是helm原生不支持nexus，所以我们需要一个插件来支持helm的上传。   
参考 https://github.com/sonatype-nexus-community/helm-nexus-push     
正常情况下
```shell
helm plugin install --version master https://github.com/sonatype-nexus-community/helm-nexus-push.git
```
 就搞定了额，但是国内的网络环境不允许， 所以你可以用下面两个方法之一：
1. 克隆仓库到公司内网的git上，更换安装地址即可
我更推荐这个，方便后续的代码修改
2. 下载zip包，解压到helm的plugins目录下
从github下载解压到  /root/.local/share/helm/plugins/
```shell
helm plugin list # 查看是否安装成功
helm plugin uninstall nexus-push # 卸载
```
### 准备nexus仓库
这里只需要注意改nexus策略为允许复写-允许相同版本的chart被覆盖
```shell
Deployment policy:
Controls if deployments of and updates to artifacts are allowed
Allow redeploy
```
**helm会拉默认最新的版本，但是需要先执行helm repo update**
测试一下仓库是否正常,如下推送当前目录下的rabbitmq 到sygl仓库
```shell
helm repo add sygl xxxxxxx
helm nexus-push  sygl rabbitmq -u xxxx -p 'xxxx'
```
### 准备jenkins job
直接用pipeline吧
```groovy
def CODE_REPO = 'ssh://xxxxx'
def CODE_COMMITID = ''
def CODE_TAG = ''
def CODE_BRANCH = ''
def CODE_REF = ''
def K8S_SERVER = 'https://xxxxxx'
pipeline {
    agent {
      label "k8s-job"
    }
    parameters {
        string(name: 'tag', defaultValue: '', description: 'tag')
        string(name: 'branch', description: '指定分支，如已指定tag则忽略本参数')
        string(name: 'ref',  description: '忽略tag和branch参数')
        string(name: 'git_url',  description: 'git clone url')
    }
    triggers {
      GenericTrigger(
       genericVariables: [
        [key: 'ref', value: '$.ref'],
        [key: 'event_name', value: '$.event_name']
       ],
       
       genericRequestVariables: [
        [key: 'deploy', regexpFilter: 'true'],
       ],

       causeString: 'Triggered on $ref',

       token: JOB_BASE_NAME,
       tokenCredentialId: '',

       printContributedVariables: true,
       printPostContent: true,

       silentResponse: false,

       shouldNotFlattern: false,

       regexpFilterText: 'event_name=$event_name;ref=$ref',
       regexpFilterExpression: 'event_name=(push|tag_push);ref=(refs/heads/release|refs/heads/master|refs/tags/.*)'
      )
    }
    stages {
        stage('Pull Code'){
            steps {
                script {
                    if (params.ref) {
                        CODE_REF = params.ref
                        def bs = CODE_REF.split('/')
                        if(bs[1] == 'tags'){
                            CODE_TAG = bs[2]
                            CODE_BRANCH = ''
                        }
                        else {
                            CODE_TAG = ''
                            CODE_BRANCH = bs[-1]
                        }
                    }
                    else if (params.tag) {
                        CODE_REF = "refs/tags/${params.tag}"
                        CODE_TAG = params.tag
                        CODE_BRANCH = ''
                    }
                    else if (params.branch) {
                        CODE_REF = "refs/heads/${params.branch}"
                        CODE_TAG = ''
                        CODE_BRANCH = params.branch
                    }

                    echo "ref: $CODE_REF"
                    echo "tag: $CODE_TAG"
                    echo "branch: $CODE_BRANCH"

                    checkout([$class: 'GitSCM', branches: [[name: CODE_REF]], extensions: [], userRemoteConfigs: [[credentialsId: 'jenkins-ssh-key', url: CODE_REPO]]])

                }
            }
        }
        stage('Prepare') {
            steps {
                sh """
                # 添加仓库
                helm repo add sygl xxxxxxxx
                helm repo update
                # 安装插件
                helm plugin list
                helm plugin uninstall nexus-push
                helm plugin list
                helm plugin install --version master  xxxxx
                helm plugin list
                """
            }
        }
        /*
        stage('Dry Run') {
            steps {
                script {
                    withKubeConfig(caCertificate: '', clusterName: 'kubernetes', contextName: 'kubernetes-admin@kubernetes', credentialsId: 'testk8s', namespace: '', serverUrl: K8S_SERVER) {
                        sh """
                        set -x
                        for chart in `ls charts`; do
                            helm install --dry-run  --generate-name charts/\$chart
                        done
                        """
                    }
                }
            }
        }
        */
        stage('Upload') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'sygl-helm-auth', passwordVariable: 'password', usernameVariable: 'username')]) {
                    sh """
                        echo $username $password
                        for chart in `ls charts`; do
                            helm nexus-push sygl charts/\$chart  -u $username  -p $password
                        done
                    """
                }
            }
        }
    }
}
```
#### 注意点
- 在jenkinspipeline中转义shell变量
- dry-run 不适合模板情况，在我们的平台中values.yaml是平台管理的，所以不适合dry-run
- 触发器的doc
```shell

这段代码是一个用于持续集成（CI）系统的触发器配置，它定义了一个通用的触发器（GenericTrigger）。下面是对配置项的解释：
- `genericVariables`: 定义了一组变量，这些变量可以从触发事件的数据中提取值。这里定义了两个变量：
  - `ref`: 从事件的 JSON 数据中提取 `$.ref` 字段的值。
  - `event_name`: 从事件的 JSON 数据中提取 `$.event_name` 字段的值。
- `genericRequestVariables`: 定义了一组请求变量，这些变量用于过滤请求。这里定义了一个变量：
  - `deploy`: 使用正则表达式 `true` 来过滤请求，只有当请求中包含 `deploy=true` 时，触发器才会被激活。
- `causeString`: 定义了触发器被触发时显示的字符串。这里的 `$ref` 将会被实际提取的 `ref` 变量值替换。
- `token`: 指定了用于触发构建的令牌，这里是 `JOB_BASE_NAME`，表示使用 Jenkins 作业的基本名称作为令牌。
- `tokenCredentialId`: 用于身份验证的凭据 ID，这里为空，表示不需要凭据。
- `printContributedVariables`: 如果为 `true`，则在触发构建时打印贡献的变量。
- `printPostContent`: 如果为 `true`，则在触发构建时打印 POST 请求的内容。
- `silentResponse`: 如果为 `true`，则在触发器被激活时不显示任何响应。这里设置为 `false`，表示会显示响应。
- `shouldNotFlattern`: 如果为 `true`，则不会将 JSON 数据扁平化。这里设置为 `false`，表示数据会被扁平化。
- `regexpFilterText`: 定义了一个正则表达式过滤文本，用于匹配事件。这里的 `$event_name` 和 `$ref` 将会被实际提取的变量值替换。
- `regexpFilterExpression`: 定义了一个正则表达式，用于进一步过滤事件。这里的意思是，只有当 `event_name` 是 `push` 或 `tag_push`，并且 `ref` 是 `refs/heads/release`、`refs/heads/master` 或 `refs/tags/.*`（即任何标签引用）时，触发器才会被激活。
综上所述，这个触发器配置用于在特定的 Git 事件（如 push 或 tag_push）发生时，并且引用（ref）是特定的分支（如 release 或 master）或标签时，触发一个构建作业。
```
### 调整nexus-push插件-可选
nexus-push默认逻辑在处理目录时会调用helm package，如果是模板系统的会报错影响流程，所以我们需要调整一下, 替换helm package为tar
```shell
        if [[ -d "$CHART" ]]; then
#            CHART_PACKAGE="$(helm package "$CHART" | cut -d":" -f2 | tr -d '[:space:]')"
            CHART_name=$(grep 'name:' "$CHART"/Chart.yaml | cut -d' ' -f2)
            CHART_version=$(grep 'version:' "$CHART"/Chart.yaml | cut -d' ' -f2)
            CHART_PACKAGE="$CHART_name"-"$CHART_version".tgz
            tar -czf "$CHART_PACKAGE" "$CHART"
```
## 总结
通过上述方法我们就实现了通过git维护helm chart，每次变更jenkins自动打包上传到nexus。但是整个流程其实还差一部分工作，那就是是运维平台需要调整来适配本地chart到仓库的变化。   
其实直接单独建立仓库，然后代码启动前克隆对应的仓库把文件移动到指定目录同样可以解决问题，而且代码不用调整。从解决这个问题看，毫无疑问效果更好，但是从标准化来说，建立仓库是更好的选择。
## 参考文档
- https://gitlab.com/rverchere/helm-chart-release-example