# 使用 Node.js 官方镜像作为基础镜像
FROM node:latest

# 创建并设置应用的工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json（如果存在）
COPY package*.json ./

# 安装项目依赖
RUN npm install

# 复制所有源代码到工作目录
COPY . .

# 应用在容器内监听的端口
EXPOSE 3100

# 定义环境变量，例如：数据库地址、端口号等（根据实际情况添加）
# ENV DB_HOST=localhost
# ENV DB_PORT=27017

# 定义容器启动时执行的命令
CMD ["node", "app.js"] # 假设您的启动文件是 index.js
