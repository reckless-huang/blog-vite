---
title: tcp和udp监听同一个端口
date: 2024-09-05 00:00:00
categories: [Linux]
tags: [tcp, udp]
---
# TCP和UDP可以监听同一个端口吗？
::: tip
talk is cheap, show me the code
:::
server.go
```golang
package main

import (
	"fmt"
	"net"
	"net/http"
)

func handler(w http.ResponseWriter, r *http.Request) {
	// 处理请求
	fmt.Fprintf(w, "Hi there, I love %s!", r.URL.Path[1:])
}

func main() {
	// 可以同时监听TCP和UDP么？
	// 1. 创建一个TCP服务
	http.HandleFunc("/", handler)
	go func() {
		fmt.Println("http server listening")
		err := http.ListenAndServe(":8080", nil)
		if err != nil {
			fmt.Println("http.ListenAndServe err:", err)
		}
	}()
	// 2. 创建一个UDP服务

	udpServer()

}

func udpServer() {
	listen, err := net.ListenUDP("udp", &net.UDPAddr{
		IP:   net.IPv4(0, 0, 0, 0),
		Port: 8080,
	})
	if err != nil {
		fmt.Println("Listen failed, err: ", err)
		return
	}
	fmt.Println("udp server listening")
	defer listen.Close()
	for {
		var data [1024]byte
		n, addr, err := listen.ReadFromUDP(data[:]) // 接收数据
		if err != nil {
			fmt.Println("read udp failed, err: ", err)
			continue
		}
		fmt.Println("data:%v addr:%v count:%v\n", string(data[:n]), addr, n)
		_, err = listen.WriteToUDP(data[:n], addr) // 发送数据
		if err != nil {
			fmt.Println("Write to udp failed, err: ", err)
			continue
		}
	}
}
```
client.go
```golang
package main

import (
	"fmt"
	"net"
)

// UDP 客户端
func main() {
	socket, err := net.DialUDP("udp", nil, &net.UDPAddr{
		IP:   net.IPv4(0, 0, 0, 0),
		Port: 8080,
	})
	if err != nil {
		fmt.Println("连接UDP服务器失败，err: ", err)
		return
	}
	defer socket.Close()
	sendData := []byte("Hello Server")
	_, err = socket.Write(sendData) // 发送数据
	if err != nil {
		fmt.Println("发送数据失败，err: ", err)
		return
	}
	data := make([]byte, 4096)
	n, remoteAddr, err := socket.ReadFromUDP(data) // 接收数据
	if err != nil {
		fmt.Println("接收数据失败, err: ", err)
		return
	}
	fmt.Printf("recv:%v addr:%v count:%v\n", string(data[:n]), remoteAddr, n)
}
```
## 测试
1. 运行server.go
```
http server listening
udp server listening
data:%v addr:%v count:%v
 Hello Server 127.0.0.1:63441 12
```
2. 运行client.go
```
recv:Hello Server addr:127.0.0.1:8080 count:12
```
**毫无疑问，TCP和UDP可以监听同一个端口。**
::: tip
在数据链路层中，通过mac地址寻找局域网中的主机。在网络层中，通过ip地址寻找网络中互联的主机或路由器。在传输层中，通过端口号寻来识别同一台主机上的不同应用程序。   
所以在传输层中，端口号的作用是区分同一台主机上的不同应用程序的数据包。    
而TCP和UDP是两个不同的协议，所以TCP和UDP可以监听同一个端口。
:::