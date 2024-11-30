---
title: 使用fio评估etcd磁盘性能
date: 2024-11-30 00:00:00
author: 云原生Space
isOriginal: false
articleTitle: 使用 fio 测试 Etcd 真实负载磁盘性能
articleLink: https://mp.weixin.qq.com/s/Sh1Zne2u_d9mA6FxVQgN9Q
categories: 
  - linux
tags:
  - etcd
  - fio
---
# 使用 fio 测试 Etcd 真实负载磁盘性能
etcd 是一款分布式键值对存储，对磁盘存储性能要求较高。根据官网描述：

> _etcd 对磁盘写请求非常敏感，通常需要 50 个连续的 IOPS（例如7200 RPM磁盘）。对于高负载群集，建议使用500个连续 IOPS（例如，典型的本地 SSD 或高性能虚拟化块设备）。请注意，大多数云提供商都发布并发 IOPS，而不是顺序 IOPS。已发布的并发 IOPS 可以比顺序 IOPS 大10倍。为了衡量实际的顺序 IOPS，我们建议使用磁盘基准测试工具，例如 diskbench或 fio。_
>
> _etcd 仅需要适度的磁盘带宽，但是当故障成员需要同步集群数据时，更大的磁盘带宽可以缩短恢复时间。通常，每秒 10MB 的速度将在15秒内恢复 100MB 的数据。对于大型群集，建议使用 100MB/s 或更高的速度在15秒内恢复 1GB 数据。_
>

总之，使用 etcd 时，需要选择性能较好的磁盘，推荐 SSD。

K8S 集群默认使用 etcd 作为其后端存储，K8S 的稳定性和性能很大程度上取决与 etcd 的性能，etcd 请求延迟大、频繁换主等问题都会导致 K8S 集群报错。导致这些问题的原因基本是 etcd 存储性能导致。所以在部署 K8S 自前很有必要测试 etcd 数据所在磁盘的性能，将得到的测试结果与官网的推荐值作比较。

## <font style="color:rgb(15, 76, 129);">etcd I/O 场景</font>
<font style="color:rgb(63, 63, 63);">在测试之前，需要了解 etcd 主要的 I/O 场景，才能测试出真实负载情况下的 etcd 所需磁盘性能。</font>

<font style="color:rgb(63, 63, 63);">etcd 真实负载是一个多读少写的场景，大约 7：3 的比例，主要有以下磁盘 io 场景：</font>

### <font style="color:rgb(15, 76, 129);">WAL ( Write-Ahead Log ) 写入</font>
<font style="color:rgb(63, 63, 63);">在每次向 etcd 写入数据时，etcd 会首先将操作记录到 WAL 中，WAL 记录存在 etcd 后端 </font>`<font style="color:rgb(221, 17, 68);">${etcd-data}/member/wal</font>`<font style="color:rgb(63, 63, 63);"> 中，用于保证集群的一致性、可恢复性。</font>

<font style="color:rgb(63, 63, 63);">在 kubernetes 集群中典型场景就是，API Server 发送的写操作（如创建、更新或删除资源）会触发 WAL 写入。</font>

<font style="color:rgb(63, 63, 63);">这个过程是一个 4KB 随机写操作，存储文件较小，属于高频写入，所以对磁盘 IOPS 较敏感，对吞吐量( BW ) 要求不高。</font>

| **<font style="color:rgb(15, 76, 129);">属性</font>** | **<font style="color:rgb(15, 76, 129);">WAL</font>** |
| --- | --- |
| **<font style="color:rgb(15, 76, 129);">功能</font>** | <font style="color:rgb(63, 63, 63);">记录增量操作日志</font> |
| **<font style="color:rgb(15, 76, 129);">写入频率</font>** | <font style="color:rgb(63, 63, 63);">高频写入，对 IOPS 较敏感</font> |
| **<font style="color:rgb(15, 76, 129);">存储大小</font>** | <font style="color:rgb(63, 63, 63);">文件较小</font> |
| **<font style="color:rgb(15, 76, 129);">触发条件</font>** | <font style="color:rgb(63, 63, 63);">每次写操作</font> |
| **<font style="color:rgb(15, 76, 129);">I/O 模式</font>** | <font style="color:rgb(63, 63, 63);">4KB，随机写</font> |
| **<font style="color:rgb(15, 76, 129);">场景</font>** | <font style="color:rgb(63, 63, 63);">保证数据一致性</font> |


### <font style="color:rgb(15, 76, 129);">快照 ( Snapshot ) 写入</font>
<font style="color:rgb(63, 63, 63);">etcd 会周期性地将内存中的最新状态数据写入磁盘，形成快照文件，snapshot 文件存在 etcd 后端 </font>`<font style="color:rgb(221, 17, 68);">${etcd-data}/member/snap</font>`<font style="color:rgb(63, 63, 63);"> 。snapshot 是和 WAL 作用互补，用于减少 WAL 文件数量，有化存储和恢复效率。快照会在生成后，清理老的 WAL 文件，在做数据恢复时，先加载快照文件，然后回放到未记录到 snapshot 的 WAL 记录。</font>

<font style="color:rgb(63, 63, 63);">这个过程是一个大块 ( MB ) 顺序写操作，存储文件较大，由于是定期写入，所以频率较低，对磁盘吞吐量 ( BW ) 要求高。</font>

### <font style="color:rgb(15, 76, 129);">数据读取</font>
<font style="color:rgb(63, 63, 63);">etcd 的读取操作大多先经过缓存，如果缓存未命中，需要从磁盘读取，所以大部分读取数据不涉及磁盘 I/O</font>

### <font style="color:rgb(15, 76, 129);">数据恢复</font>
<font style="color:rgb(63, 63, 63);">etcd 节点宕机、重新启动时，需要从磁盘加载数据，这块涉及到 snapshot 数据加载和 WAL 日志重放；加载 snapshot 属于顺序读，数据量较大，重放 WAL 日志属于4KB，随机读</font>

### <font style="color:rgb(15, 76, 129);">定期清理</font>
<font style="color:rgb(63, 63, 63);">etcd 保留多版本数据，需要定期清理历史版本数据，数据量中等，属于顺序写操作</font>

### <font style="color:rgb(15, 76, 129);">总结</font>
| **<font style="color:rgb(15, 76, 129);">场景</font>** | **<font style="color:rgb(15, 76, 129);">I/O 模式</font>** | **<font style="color:rgb(15, 76, 129);">数据量</font>** | **<font style="color:rgb(15, 76, 129);">I/O 频率</font>** | **<font style="color:rgb(15, 76, 129);">延迟敏感性</font>** |
| --- | --- | --- | --- | --- |
| **<font style="color:rgb(15, 76, 129);">WAL 写入</font>** | <font style="color:rgb(63, 63, 63);">随机写</font> | <font style="color:rgb(63, 63, 63);">4KB</font> | <font style="color:rgb(63, 63, 63);">高频</font> | <font style="color:rgb(63, 63, 63);">IOPS 敏感</font> |
| **<font style="color:rgb(15, 76, 129);">快照写入</font>** | <font style="color:rgb(63, 63, 63);">顺序写</font> | <font style="color:rgb(63, 63, 63);">大块 MB</font> | <font style="color:rgb(63, 63, 63);">周期性</font> | <font style="color:rgb(63, 63, 63);">吞吐 (BW) 敏感</font> |
| **<font style="color:rgb(15, 76, 129);">数据读取</font>** | <font style="color:rgb(63, 63, 63);">随机读</font> | <font style="color:rgb(63, 63, 63);">较小 KB</font> | <font style="color:rgb(63, 63, 63);">低频(大部分在内存)</font> | <font style="color:rgb(63, 63, 63);">低</font> |
| **<font style="color:rgb(15, 76, 129);">数据恢复</font>** | <font style="color:rgb(63, 63, 63);">顺序读 + 随机读</font> | <font style="color:rgb(63, 63, 63);">较大 MB</font> | <font style="color:rgb(63, 63, 63);">重启、灾难恢复</font> | <font style="color:rgb(63, 63, 63);">吞吐 (BW) 敏感</font> |
| **<font style="color:rgb(15, 76, 129);">定期清理</font>** | <font style="color:rgb(63, 63, 63);">顺序写</font> | <font style="color:rgb(63, 63, 63);">中等</font> | <font style="color:rgb(63, 63, 63);">低频</font> | <font style="color:rgb(63, 63, 63);">低</font> |


<font style="color:rgb(63, 63, 63);">搞清楚了 etcd 的 I/O 场景，就可以通过工具模拟出 etcd 的真实 I/O 负载来测试磁盘性能。这里使用 fio 命令测试说明。</font>

<font style="color:rgb(63, 63, 63);">结合上述说明，大概清楚了 etcd 主要在 4KB + 随机写 的场景对磁盘 IOPS 非常敏感，下面模拟一个中等的 kubernetes 集群，etcd 的磁盘性能测试：</font>

### <font style="color:rgb(15, 76, 129);">构造真实用例</font>
<font style="color:rgb(63, 63, 63);">在一个中等 kubernetes (250 node)集群中，请求 etcd 的客户端不超过 500，每秒的请求数不超过 1000，以及存储数据不超过 500MB。</font>

```plain
$ fio --name=etcd-mixed-load \
    --ioengine=libaio \
    --direct=1 \
    --rw=randrw \
    --rwmixread=80 \
    --bs=4k \
    --size=1G \
    --runtime=60 \
    --time_based \
    --numjobs=20 \
    --iodepth=8 \
    --fsync_on_close=1
```

**<font style="color:rgb(15, 76, 129);">参数说明</font>**

| **<font style="color:rgb(15, 76, 129);">参数</font>** | **<font style="color:rgb(15, 76, 129);">描述</font>** |
| --- | --- |
| `<font style="color:rgb(221, 17, 68);">--name=etcd-mixed-load</font>` | <font style="color:rgb(63, 63, 63);">测试任务名称，方便记录日志和结果。</font> |
| `<font style="color:rgb(221, 17, 68);">--ioengine=libaio</font>` | <font style="color:rgb(63, 63, 63);">使用异步 I/O 引擎</font> |
| `<font style="color:rgb(221, 17, 68);">--direct=1</font>` | <font style="color:rgb(63, 63, 63);">关闭文件系统缓存，直接访问磁盘，模拟真实负载。由于 etcd 读大多数走缓存，所以这里关闭缓存模拟读请求最大性能</font> |
| `<font style="color:rgb(221, 17, 68);">--rw=randrw</font>` | <font style="color:rgb(63, 63, 63);">随机读写混合，模拟 etcd 的读写模式。</font> |
| `<font style="color:rgb(221, 17, 68);">--rwmixread=80</font>` | <font style="color:rgb(63, 63, 63);">读写比例设为 70:30，符合 etcd “读多写少”的典型特性。</font> |
| `<font style="color:rgb(221, 17, 68);">--bs=4k</font>` | <font style="color:rgb(63, 63, 63);">I/O 块大小为 4KB，模拟 etcd 典型 I/O 块大小。</font> |
| `<font style="color:rgb(221, 17, 68);">--size=500MB</font>` | <font style="color:rgb(63, 63, 63);">测试文件总大小为 500MB，etcd 存储数据量并不大，模拟中等 kubernetes 集群数据量</font> |
| `<font style="color:rgb(221, 17, 68);">--runtime=60</font>` | <font style="color:rgb(63, 63, 63);">测试持续时间为 60 秒，充分反映磁盘性能。</font> |
| `<font style="color:rgb(221, 17, 68);">--time_based</font>` | <font style="color:rgb(63, 63, 63);">使用时间控制测试，而不是完成全部数据量后结束。</font> |
| `<font style="color:rgb(221, 17, 68);">--numjobs=16</font>` | <font style="color:rgb(63, 63, 63);">模拟 16 个线程，反映 etcd 在集群中的多并发操作</font> |
| `<font style="color:rgb(221, 17, 68);">--iodepth=8</font>` | <font style="color:rgb(63, 63, 63);">表示一个线程可以同时提交的 I/O 请求量</font> |
| `<font style="color:rgb(221, 17, 68);">--fsync_on_close=1</font>` | <font style="color:rgb(63, 63, 63);">在写操作完成后强制刷新到磁盘，模拟 etcd WAL 写入的持久化要求。</font> |


<font style="color:rgb(63, 63, 63);">fio 使用 </font>`<font style="color:rgb(221, 17, 68);">--numjobs、--iodepth</font>`<font style="color:rgb(63, 63, 63);"> 结合模拟 etcd 客户端数量和请求量。</font>

### <font style="color:rgb(15, 76, 129);">结果分析</font>
<font style="color:rgb(63, 63, 63);">上述命令执行后，会生成 numjobs 个结果，表示每个线程的测试结果，下面通过一个线程的结果分析：</font>

```plain
etcd-mixed-load: (groupid=0, jobs=1): err= 0: pid=1374427: Fri Nov 22 17:33:59 2024
  # 读请求结果
   read: IOPS=4267, BW=16.7MiB/s (17.5MB/s)(1000MiB/60007msec)
    slat (nsec): min=1740, max=34351k, avg=160765.28, stdev=562867.31
    clat (nsec): min=450, max=62334k, avg=3069877.11, stdev=3678590.76
     lat (usec): min=2, max=62379, avg=3230.77, stdev=3758.39
    clat percentiles (usec):
     |  1.00th=[  322],  5.00th=[  832], 10.00th=[ 1123], 20.00th=[ 1467],
     | 30.00th=[ 1696], 40.00th=[ 1876], 50.00th=[ 2057], 60.00th=[ 2278],
     | 70.00th=[ 2769], 80.00th=[ 3752], 90.00th=[ 5538], 95.00th=[ 7635],
     | 99.00th=[22414], 99.50th=[29230], 99.90th=[37487], 99.95th=[39060],
     | 99.99th=[42730]
   bw (  KiB/s): min=12152, max=23008, per=4.98%, avg=17070.87, stdev=2449.05, samples=120
   iops        : min= 3038, max= 5752, avg=4267.68, stdev=612.26, samples=120
  
  # 写请求结果
  write: IOPS=1061, BW=4245KiB/s (4347kB/s)(249MiB/60007msec)
    slat (usec): min=4, max=29655, avg=167.41, stdev=538.60
    clat (usec): min=26, max=40851, avg=1909.03, stdev=2384.85
     lat (usec): min=53, max=43111, avg=2076.58, stdev=2477.39
    clat percentiles (usec):
     |  1.00th=[  297],  5.00th=[  537], 10.00th=[  709], 20.00th=[ 1020],
     | 30.00th=[ 1287], 40.00th=[ 1500], 50.00th=[ 1680], 60.00th=[ 1844],
     | 70.00th=[ 2008], 80.00th=[ 2212], 90.00th=[ 2573], 95.00th=[ 3163],
     | 99.00th=[10028], 99.50th=[22414], 99.90th=[35390], 99.95th=[36963],
     | 99.99th=[39584]
   bw (  KiB/s): min= 3248, max= 5840, per=4.95%, avg=4245.08, stdev=667.07, samples=120
   iops        : min=  812, max= 1460, avg=1061.25, stdev=166.76, samples=120
   
  # 总体结果
  lat (nsec)   : 500=0.06%, 750=0.20%, 1000=0.01%
  lat (usec)   : 2=0.01%, 4=0.01%, 10=0.02%, 20=0.03%, 50=0.05%
  lat (usec)   : 100=0.07%, 250=0.34%, 500=1.38%, 750=3.28%, 1000=4.55%
  lat (msec)   : 2=41.78%, 4=33.10%, 10=12.39%, 20=1.70%, 50=1.05%
  lat (msec)   : 100=0.01%
  cpu          : usr=1.00%, sys=42.39%, ctx=162092, majf=0, minf=126
  IO depths    : 1=0.1%, 2=0.1%, 4=0.1%, 8=0.1%, 16=100.0%, 32=0.0%, >=64=0.0%
     submit    : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.0%, 32=0.0%, 64=0.0%, >=64=0.0%
     complete  : 0=0.0%, 4=100.0%, 8=0.0%, 16=0.1%, 32=0.0%, 64=0.0%, >=64=0.0%
     issued rwts: total=256107,63685,0,0 short=0,0,0,0 dropped=0,0,0,0
     latency   : target=0, window=0, percentile=100.00%, depth=16
  Run status group 0 (all jobs):
   READ: bw=416MiB/s (436MB/s), 416MiB/s-416MiB/s (436MB/s-436MB/s), io=13.0GiB (15.0GB), run=34469-34469msec
   WRITE: bw=178MiB/s (187MB/s), 178MiB/s-178MiB/s (187MB/s-187MB/s), io=6149MiB (6447MB), run=34469-34469msec

 Disk stats (read/write):
   vdb: ios=914415/392173, merge=0/0, ticks=5986235/2577115, in_queue=7910956, util=65.39%
```

<font style="color:rgb(63, 63, 63);">下面解释几个重要参数：</font>

+ <font style="color:rgb(63, 63, 63);">• </font>**<font style="color:rgb(15, 76, 129);">IOPS</font>**
    - <font style="color:rgb(63, 63, 63);">• 单位：个数</font>
    - <font style="color:rgb(63, 63, 63);">• 意义：每秒的 I/O 次数，反应磁盘性能重要参数，IOPS 越高，表示磁盘性能越好</font>
    - <font style="color:rgb(63, 63, 63);">• 场景：在一些高频的小块随机读、写情况下，IOPS 越高，服务性能越好，例如 etcd 的 WAL 日志记录</font>
+ <font style="color:rgb(63, 63, 63);">• </font>**<font style="color:rgb(15, 76, 129);">BW (吞吐量)</font>**
    - <font style="color:rgb(63, 63, 63);">• 单位：MB/s</font>
    - <font style="color:rgb(63, 63, 63);">• 意义：每秒的数据传输大小，反应磁盘吞吐量，BW 越高，表示磁盘性能越好</font>
    - <font style="color:rgb(63, 63, 63);">• 场景：在大块的顺序读、写情况下，BW 越高，服务性能越好，例如 snapshot</font>
+ <font style="color:rgb(63, 63, 63);">• </font>**<font style="color:rgb(15, 76, 129);">lat (延迟)</font>**
    - <font style="color:rgb(63, 63, 63);">• slat：表示提交 I/O 的延迟，单位 nsec 是纳秒</font>
    - <font style="color:rgb(63, 63, 63);">• clat：表示从提交完到完成 I/O 的延迟，单位 nsec 是纳秒</font>
    - <font style="color:rgb(63, 63, 63);">• lat</font>**<font style="color:rgb(15, 76, 129);">：</font>**`<font style="color:rgb(221, 17, 68);">lat = slat + clat</font>`<font style="color:rgb(63, 63, 63);">，表示从请求提交给内核，再到内核完成这个 I/O 为止所需要的时间，单位 usec 是微秒，1 usec = 1000 nsec</font>
+ <font style="color:rgb(63, 63, 63);">• </font>**<font style="color:rgb(15, 76, 129);">cpu</font>**
    - <font style="color:rgb(63, 63, 63);">• usr：用户态 cpu 使用率</font>
    - <font style="color:rgb(63, 63, 63);">• sys：内核态 cpu 使用率，如果 sys 非常高的话，说明 I/O 使用频率很高，可能系统遭遇瓶颈</font>
    - <font style="color:rgb(63, 63, 63);">• ctx：cpu 上下文交换次数</font>
+ <font style="color:rgb(63, 63, 63);">• </font>**<font style="color:rgb(15, 76, 129);">util：</font>**
    - <font style="color:rgb(63, 63, 63);">• 如果 util 较高的话，说明 I/O 使用率很高，表示磁盘性能将遭遇瓶颈，此时的 IOPS，BW 等结果即可表明该磁盘的性能；</font>
    - <font style="color:rgb(63, 63, 63);">• 如果 util 较低，说明磁盘性能还有空间，可增加 iodepth 重新测试，util、IOPS、BW 也同步增加</font>
    - <font style="color:rgb(63, 63, 63);">• 如果增加 iodepth 一定量时，util，IOPS、BW 下降的话，说明磁盘已经过载，可降低 iodepth，找到最佳性能参数</font>

## <font style="color:rgb(15, 76, 129);">总结</font>
<font style="color:rgb(63, 63, 63);">etcd 对磁盘要求较高，当部署 etcd 之前，非常有必要测试一下磁盘的性能，避免后期由磁盘性能弱导致 etcd 稳定性。</font>

<font style="color:rgb(63, 63, 63);">但是测试需要结合真实负载情况，才能有效测出数据的真实性。</font>


> 来自: [使用 fio 测试 Etcd 真实负载磁盘性能](https://mp.weixin.qq.com/s/Sh1Zne2u_d9mA6FxVQgN9Q)
>
