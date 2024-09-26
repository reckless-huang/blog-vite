---
title: langchain智谱AI
date: 2024-09-26 00:00:00
categories: 
  - devops
tags:
  - langchain
  - AI
---
# langchain智谱AI尝试
::: tip
智谱有免费的模型，正好用来做一些实验。
https://open.bigmodel.cn/dev/api/normal-model/glm-4
:::
## 注意
- 创建秘钥 https://open.bigmodel.cn/usercenter/apikeys
- 环境变量设置后需要重启pycharm才能生效

## code
```python
import os


def ZhipuAI():
    print(os.environ.get('zhipuai'))
    return ChatZhipuAI(
        api_key=os.environ.get('zhipuai'),
        base_url="https://open.bigmodel.cn/api/paas/v4/chat/completions",
        model="glm-4-flash",
        tempreture=0.5,
    )

import os

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough

from utils.llm import ZhipuAI


def test_zhipin():
    llm = ZhipuAI()
    promt = PromptTemplate.from_template("""
    你是一个golang开发工程师，请直接输出代码
    问题：{question}
    """)
    chain = {
        "question": RunnablePassthrough()
    } | promt | llm | StrOutputParser()
    result = chain.invoke("请帮我写一个golang的http服务")
    print(result)



if __name__ == '__main__':
    print(os.getenv('zhipuai'))
    test_zhipin()
```
requirement.txt 直接贴了完整的
```txt
aiohttp==3.9.5
aiosignal==1.3.1
annotated-types==0.7.0
anyio==4.6.0
attrs==23.2.0
certifi==2024.7.4
charset-normalizer==3.3.2
colorama==0.4.6
dataclasses-json==0.6.7
filelock==3.15.4
frozenlist==1.4.1
fsspec==2024.6.1
greenlet==3.0.3
h11==0.14.0
httpcore==1.0.5
httpx==0.27.2
huggingface-hub==0.23.5
idna==3.7
jsonpatch==1.33
jsonpointer==3.0.0
langchain==0.2.8
langchain-community==0.2.7
langchain-core==0.2.19
langchain-text-splitters==0.2.2
langsmith==0.1.86
marshmallow==3.21.3
multidict==6.0.5
mypy-extensions==1.0.0
numpy==1.26.4
orjson==3.10.6
packaging==24.1
pydantic==2.8.2
pydantic_core==2.20.1
PyJWT==2.9.0
PyYAML==6.0.1
regex==2024.5.15
requests==2.32.3
safetensors==0.4.3
sniffio==1.3.1
SQLAlchemy==2.0.31
tenacity==8.5.0
tokenizers==0.19.1
tqdm==4.66.4
transformers==4.42.4
typing-inspect==0.9.0
typing_extensions==4.12.2
urllib3==2.2.2
yarl==1.9.4
```