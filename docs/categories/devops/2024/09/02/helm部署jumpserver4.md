---
title: Helm部署Jumpserver4
date: 2024-09-02 00:00:00
categories: [DevOps]
tags: [Helm, Jumpserver]
---
# jumpserver4+作业功能测试
::: tip
jumpserver已经迭代到4.0版本，之前的印象还在3.0版本，这次主要是为了测试作业功能，记录测试过程
:::
## helm部署jumpserver4
### 部署mysql和redis   
mysql和redis一般需要单独部署,注意mysql需要手动创建jumpserver数据库,贴一下我常用的yaml  
mysql的yaml
```yaml
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql-primary
spec:
  replicas: 1
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      app.kubernetes.io/component: primary
      app.kubernetes.io/instance: mysql
  serviceName: mysql-primary
  template:
    metadata:
      creationTimestamp: null
      labels:
        app.kubernetes.io/component: primary
        app.kubernetes.io/instance: mysql
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app.kubernetes.io/instance: mysql
                    app.kubernetes.io/name: mysql
                topologyKey: kubernetes.io/hostname
              weight: 1
      containers:
        - env:
            - name: BITNAMI_DEBUG
              value: 'false'
            - name: MYSQL_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  key: mysql-root-password
                  name: mysql
            - name: MYSQL_USER
              value: jumpserver
            - name: MYSQL_PASSWORD
              valueFrom:
                secretKeyRef:
                  key: mysql-password
                  name: mysql
            - name: MYSQL_DATABASE
              value: my_database
            - name: MYSQL_REPLICATION_MODE
              value: master
            - name: MYSQL_REPLICATION_USER
              value: replicator
            - name: MYSQL_REPLICATION_PASSWORD
              valueFrom:
                secretKeyRef:
                  key: mysql-replication-password
                  name: mysql
          image: 'docker.io/bitnami/mysql:8.0.32-debian-11-r21'
          imagePullPolicy: IfNotPresent
          livenessProbe:
            exec:
              command:
                - /bin/bash
                - '-ec'
                - |
                  password_aux="${MYSQL_ROOT_PASSWORD:-}"
                  if [[ -f "${MYSQL_ROOT_PASSWORD_FILE:-}" ]]; then
                      password_aux=$(cat "$MYSQL_ROOT_PASSWORD_FILE")
                  fi
                  mysqladmin status -uroot -p"${password_aux}"
            failureThreshold: 3
            initialDelaySeconds: 5
            periodSeconds: 10
            successThreshold: 1
            timeoutSeconds: 1
          name: mysql
          ports:
            - containerPort: 3306
              name: mysql
              protocol: TCP
          readinessProbe:
            exec:
              command:
                - /bin/bash
                - '-ec'
                - |
                  password_aux="${MYSQL_ROOT_PASSWORD:-}"
                  if [[ -f "${MYSQL_ROOT_PASSWORD_FILE:-}" ]]; then
                      password_aux=$(cat "$MYSQL_ROOT_PASSWORD_FILE")
                  fi
                  mysqladmin status -uroot -p"${password_aux}"
            failureThreshold: 3
            initialDelaySeconds: 5
            periodSeconds: 10
            successThreshold: 1
            timeoutSeconds: 1
          resources:
            limits:
              memory: 20Gi
            requests:
              memory: 20Gi
          securityContext:
            runAsNonRoot: true
            runAsUser: 1001
          startupProbe:
            exec:
              command:
                - /bin/bash
                - '-ec'
                - |
                  password_aux="${MYSQL_ROOT_PASSWORD:-}"
                  if [[ -f "${MYSQL_ROOT_PASSWORD_FILE:-}" ]]; then
                      password_aux=$(cat "$MYSQL_ROOT_PASSWORD_FILE")
                  fi
                  mysqladmin status -uroot -p"${password_aux}"
            failureThreshold: 10
            initialDelaySeconds: 15
            periodSeconds: 10
            successThreshold: 1
            timeoutSeconds: 1
          terminationMessagePath: /dev/termination-log
          terminationMessagePolicy: File
          volumeMounts:
            - mountPath: /bitnami/mysql
              name: data
            - mountPath: /opt/bitnami/mysql/conf/my.cnf
              name: config
              subPath: my.cnf
      dnsPolicy: ClusterFirst
      restartPolicy: Always
      schedulerName: default-scheduler
      securityContext:
        fsGroup: 1001
      serviceAccount: mysql
      serviceAccountName: mysql
      terminationGracePeriodSeconds: 30
      volumes:
        - configMap:
            defaultMode: 420
            name: mysql-primary
          name: config
  updateStrategy:
    type: RollingUpdate
  volumeClaimTemplates:
    - apiVersion: v1
      kind: PersistentVolumeClaim
      metadata:
        creationTimestamp: null
        labels:
          app.kubernetes.io/component: primary
          app.kubernetes.io/instance: mysql
        name: data
      spec:
        accessModes:
          - ReadWriteOnce
        resources:
          requests:
            storage: 8Gi
        volumeMode: Filesystem

---
apiVersion: v1
kind: Service
metadata:
  name: mysql-primary
spec:
  externalTrafficPolicy: Cluster
  ports:
    - name: mysql
      port: 3306
      protocol: TCP
      targetPort: mysql
  selector:
    app.kubernetes.io/component: primary
    app.kubernetes.io/instance: mysql
  sessionAffinity: None
  type: NodePort

---
apiVersion: v1
data:
  my.cnf: |-
    [mysqld]
    innodb_buffer_pool_size = 16G

    # 设置InnoDB事务日志文件的大小
    innodb_log_file_size = 1G
    # 设置排序操作使用的内存缓冲区大小
    sort_buffer_size = 8M
    join_buffer_size = 8M
    # 设置在内存中创建临时表的大小限制
    tmp_table_size = 512M
    max_heap_table_size = 512M

    log-bin=mysql-bin
    default_authentication_plugin=mysql_native_password
    skip-name-resolve
    explicit_defaults_for_timestamp
    basedir=/opt/bitnami/mysql
    plugin_dir=/opt/bitnami/mysql/lib/plugin
    port=3306
    socket=/opt/bitnami/mysql/tmp/mysql.sock
    datadir=/bitnami/mysql/data
    tmpdir=/opt/bitnami/mysql/tmp
    max_allowed_packet=200M
    bind-address=*
    pid-file=/opt/bitnami/mysql/tmp/mysqld.pid
    log-error=/opt/bitnami/mysql/logs/mysqld.log
    character-set-server=UTF8
    collation-server=utf8_general_ci
    slow_query_log=1
    slow_query_log_file=/opt/bitnami/mysql/logs/slow.log
    long_query_time=3.0
    max_connections = 2000
    character-set-server = utf8mb4
    collation-server = utf8mb4_general_ci
    lower_case_table_names = 1

    [client]
    port=3306
    socket=/opt/bitnami/mysql/tmp/mysql.sock
    default-character-set=UTF8
    plugin_dir=/opt/bitnami/mysql/lib/plugin

    [manager]
    port=3306
    socket=/opt/bitnami/mysql/tmp/mysql.sock
    pid-file=/opt/bitnami/mysql/tmp/mysqld.pid
kind: ConfigMap
metadata:
  name: mysql-primary

---
apiVersion: v1
data:
  mysql-password: xxxx
  mysql-replication-password: xxxxx
  mysql-root-password: xxxxxx
kind: Secret
metadata:
  name: mysql
type: Opaque
---
apiVersion: v1
automountServiceAccountToken: true
kind: ServiceAccount
metadata:
  name: mysql
secrets:
- name: mysql
```
redis的yaml
```yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  annotations: {}
  labels:
    workload.user.cattle.io/workloadselector: redis
  name: redis
  namespace: jumpserver4
spec:
  progressDeadlineSeconds: 600
  replicas: 1
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      workload.user.cattle.io/workloadselector: redis
  strategy:
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 25%
    type: RollingUpdate
  template:
    metadata:
      creationTimestamp: null
      labels:
        workload.user.cattle.io/workloadselector: redis
    spec:
      containers:
        - image: 'redis:5.0.7'
          imagePullPolicy: IfNotPresent
          name: redis
          ports:
            - containerPort: 6379
              name: tcp6379
              protocol: TCP
          resources: {}
          terminationMessagePath: /dev/termination-log
          terminationMessagePolicy: File
      dnsPolicy: ClusterFirst
      restartPolicy: Always
      schedulerName: default-scheduler
      securityContext: {}
      terminationGracePeriodSeconds: 30

---
apiVersion: v1
kind: Service
metadata:
  annotations: {}
  labels:
    workload.user.cattle.io/workloadselector: redis
  name: redis
  namespace: jumpserver4
spec:
  externalTrafficPolicy: Cluster
  ports:
    - name: tcp6379
      port: 6379
      protocol: TCP
      targetPort: 6379
  selector:
    workload.user.cattle.io/workloadselector: redis
  sessionAffinity: None
  type: NodePort
```
### helm部署jumserver4
正常下载jumpserver4的helm chart,修改values.yaml
````shell
helm repo add jumpserver https://jumpserver.github.io/helm-charts
helm pull jumpserver/jumpserver
````
```yaml
# 配置mysql和redis
# 默认数据库是postgresql,需要修改为mysql
externalDatabase:
  engine: mysql  # Options: postgresql, mysql
# 配置国内镜像仓库
# 配置支持多节点读写的storageClass
global:
  imageRegistry: swr.cn-north-1.myhuaweicloud.com
  imageOwner: jumpserver
  ## E.g.
  #  imagePullSecrets:
  #  - myRegistryKeySecretName
  ##
  imagePullSecrets: []
  storageClass: "managed-nfs-storage"
# 修改ingress的host
# 配置secret相关
  config:
    ## Generate a new random secret key by execute `cat /dev/urandom | tr -dc A-Za-z0-9 | head -c 50`
    secretKey: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    ## Generate a new random bootstrap token by execute `cat /dev/urandom | tr -dc A-Za-z0-9 | head -c 24`
    bootstrapToken: "xxxxxxxxxxxxxxxxxxxxxxxx"
```
接下来helm install就可以了,注意一般来说第一个pod是init job用来初始化数据库的,如果很长时间没结束，可以查看pod日志
## 体验作业功能
::: tip
作业功能需要再系统设置中开启，有点beta的感觉    
系统设置-作业-开启
:::
整体感觉还是好用的, 支持shell mysql ansible等不同的方式, 但是最后都是包装成ansible执行的, 另外ansible playbook的前端展示很棒, 给jms的团队点赞
### 开源模块, 代码好好学习
https://github.com/jumpserver/jumpserver/tree/dev/apps/ops/ansible
## 参考
- [官方文档-在线安装](https://docs.jumpserver.org/zh/v4/installation/setup_kubernetes/helm_online_install/)
- [官方文档-功能介绍](https://docs.jumpserver.org/zh/v3/guide/user/ops/quick_command/)
