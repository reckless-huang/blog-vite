---
title: ubuntu配置zsh和kubectl自动补全
date: 2024-12-04 23:04:07
author: yufeng
categories:
  - linux
tags:
  - zsh
  - kubectl
---
# ubuntu配置zsh和kubectl自动补全
zsh+kubectl自动补全提高工作效率！！！
## 安装zsh并设置为默认shell
1. 安装zsh
```shell
# 查看现在的shell
cat /etc/shells
# 安装zsh
sudo apt install zsh
```
2. 设置zsh为默认shell
```shell
chsh -s $(which zsh)
```
3. 重启   
重启后会有一个简单的配置，选默认填充到配置文件即可
4. 安装autosuggestions
```shell
git clone https://github.com/zsh-users/zsh-autosuggestions ~/.oh-my-zsh/custom/plugins/zsh-autosuggestions
```
## 配置kubectl自动补全
1. 安装kubectl
```shell
# https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/
# 下载安装
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
``` 
2. 配置kubectl自动补全
```shell
echo "if [ $commands[kubectl] ]; then source <(kubectl completion zsh); fi" >> ~/.zshrc
```
3. 安装fzf
```shell
sudo apt install fzf
```
**That's OK!**:fire::fire:
## 小坑处理
1. mac不信任
```shell
sudo spctl --master-disable
```
2. 网络问题
```shell
export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 all_proxy=socks5://127.0.0.1:7890
```
3. 合并配置文件和插件使用参考
- https://imroc.cc/kubernetes/kubectl/kubie
- https://aleiwu.com/post/kubectl-guru/

   