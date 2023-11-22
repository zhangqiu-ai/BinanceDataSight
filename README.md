# 币安数据监控平台

币安数据监控平台是一个基于 Node.js 和 Express 框架构建的应用，旨在为用户提供一个简单的界面来查看和管理他们在币安账户上的加密货币资产。该平台使用 SQLite 数据库来存储用户的 API 密钥和秘密密钥，并利用币安的 API 来获取和展示账户信息及资产图表。

## 功能概述

- **设置和清除 API 密钥**: 用户可以在首页输入新的 API 密钥和秘密密钥，或清除现有密钥。
- **查看账户信息**: 提供了一个查看币安账户中有余额的各种资产及其价格的页面。
- **资产图表展示**: 使用 Chart.js 展示资产总额的时间序列图表。

## 如何使用

### 环境要求

- Node.js
- npm 或 yarn
- SQLite



### 安装和运行

1. 克隆仓库到本地：

    ```bash
    git clone https://github.com/zhangqiu-ai/binancedata.git
    ```

2. 进入项目目录：

    ```bash
    cd binancedata
    ```

3. 安装依赖：

    ```bash
    npm install
    ```

4. 启动应用：

    ```bash
    node app.js
    ```

## Docker 一键部署

币安数据监控平台也支持通过 Docker 进行快速部署。使用以下命令，您可以轻松在 Docker 环境中启动并运行该应用。

### 部署命令

```bash
docker run --name binancedata -d --restart always -p 3100:3100 \
   -v /volume1/docker/binancedata-data:/data \
   zhangqiuai/binancedata:latest
```

#### 这条命令会做以下几件事情：

    使用 --name binancedata 将容器命名为 binancedata。
    -d 参数表示在后台运行容器。
    --restart always 确保容器在退出时自动重启。
    -p 3100:3100 将容器的 3100 端口映射到主机的 3100 端口。
    -v /volume1/docker/binancedata-data:/data 将主机上的 /volume1/docker/binancedata-data 目录映射到容器的 /data 目录，用于持久化数据。
    zhangqiuai/binancedata:latest 指定使用的 Docker 镜像和标签。

#### 部署成功后通过浏览器访问：

    http://192.168.31.2:3100/
    把192.168.31.2替换成自己的服务器地址

### 使用指南

1. **设置 API 密钥**：
   
   ![image-placeholder.jpg](https://img.zhangqiu.pro/file/43b8a99ffe7fefbe5e063.png)  <!-- 替换为实际的演示图片 -->
   

   打开应用首页，输入 API 密钥和秘密密钥，点击“设置密钥”。

2. **查看账户信息**：

   ![查看账户信息](https://img.zhangqiu.pro/file/ae4744384078e643a0fe3.png)  <!-- 替换为实际的演示图片 -->

   点击“查看账户信息”，在新页面查看您币安账户中各资产的余额和价格。

3. **资产图表展示**：

   ![资产图表展示](https://img.zhangqiu.pro/file/3439f65db1e4f16ae3389.png)  <!-- 替换为实际的演示图片 -->

   点击“查看资产图表”，在新页面查看资产总额随时间的变化。

## 开发

- **技术栈**: Node.js, Express, SQLite, Axios, Chart.js
- **API**: 使用币安 API 获取账户信息和资产价格。

## 贡献

欢迎任何形式的贡献。请 Fork 仓库并提交 Pull Request。

## 许可证

此项目采用 [MIT 许可证](LICENSE)。请查阅 `LICENSE` 文件了解更多信息。

---

_文档最后更新时间：2023-11-22_
