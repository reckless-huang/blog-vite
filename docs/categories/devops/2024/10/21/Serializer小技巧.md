---
title: Serializer小技巧
date: 2024-10-21 00:00:00
categories: 
  - devops
tags:
  - Serializer
  - DRF
---
# Serializer小技巧
DRF中的Serializer是一个非常重要的组件，它可以帮助我们完成数据的序列化和反序列化，同时也可以帮助我们完成数据的校验。记录一些我常用的小技巧。
## PrimaryKeyRelatedField
比如我们的模型中这样定义
```python
envs = models.ManyToManyField(Project, verbose_name='需要发布到哪些项目', blank=True, db_constraint=False)
```
当我们需要创建这个模型的时候，我们需要传递的是一个列表，但是我们的前端传递的是一个id，这个时候我们可以使用PrimaryKeyRelatedField优化
```python
    env_ids = serializers.ListField(child=serializers.IntegerField(), required=False)

    def create(self, validated_data):
        env_ids = validated_data.pop('env_ids', [])
        isntance = super().create(validated_data)
        envs = Project.objects.filter(id__in=env_ids).all()
        isntance.envs.set(envs)
        return isntance.save()
```
上面是传统写法，不太符合DRF的风格，优化后
```python
    envs = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Project.objects.all(),
        required=False
    )

    def create(self, validated_data):
        envs = validated_data.pop('envs', [])
        instance = super().create(validated_data)
        instance.envs.set(envs)
        instance.save()
        return instance
```
## 未完待续。。。