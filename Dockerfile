# 使用 Node.js 官方镜像作为基础镜像
FROM node:latest

# 创建并设置应用的工作目录
WORKDIR /app

# 首先，复制 package.json 和 package-lock.json（如果存在）
COPY package*.json ./

# 安装项目依赖
RUN npm install

# 安装 ping、vim
RUN npm install

# 复制所有源代码到工作目录
COPY . .

# 应用在容器内监听的端口
EXPOSE 3100

# 定义容器启动时执行的命令
CMD ["node", "app.js"] # 替换为您的启动脚本
