// 导入依赖库和加载环境变量
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// 创建 Express 应用实例
const app = express();
app.use(express.urlencoded({ extended: true })); // 用于解析 application/x-www-form-urlencoded

// 设置端口
const port = 3100;

// 设置 json 文件路径
const accountInfo_file = './data/accountInfo.json';
const totalAssets_file = './data/totalAssets.json';

// 连接 SQLite 数据库
const db = new sqlite3.Database('./data/database.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
});

// 初始化数据库
// db.serialize(() => {
//     db.run(`CREATE TABLE IF NOT EXISTS keys (
//         api_key TEXT NOT NULL,
//         secret_key TEXT NOT NULL
//     )`);
// });

// 延迟函数，遵守 API 频率限制
function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

// 获取密钥
function getKeys() {
    return new Promise((resolve, reject) => {
        db.get("SELECT api_key, secret_key FROM keys ORDER BY rowid DESC LIMIT 1", (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row || {});
            }
        });
    });
}

// 生成带签名的查询字符串
async function getQueryStringWithSignature(parameters) {
    const keys = await getKeys();
    const queryString = Object.keys(parameters).map(key => `${key}=${parameters[key]}`).join('&');
    const signature = crypto.createHmac('sha256', keys.secret_key).update(queryString).digest('hex');
    return `${queryString}&signature=${signature}`;
}

// 获取指定币种的最新价格
async function fetchPrice(asset) {
    try {
        if (asset === 'USDT') {
            return '1'; // USDT 的价格始终设为 1
        }
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${asset}USDT`);
        return response.data.price;
    } catch (error) {
        // console.error(`获取 ${asset} 价格时发生错误:`, error);
        console.error(`获取 ${asset} 价格时发生错误:`);
        
        // 检查是否是无效交易对的错误
        if (error.response && error.response.data && error.response.data.code === -1121) {
            return 'N/A'; // 无效交易对，返回 'N/A'
        }
        return 'N/A'; // 其他错误，也返回 'N/A'

    }
}

// 获取币安账户信息并保存到本地文件
async function fetchAndSaveAccountInfo() {
    try {
        await delay(1000); // 遵守 API 频率限制

        const parameters = { timestamp: Date.now(), recvWindow: 10000 };
        const queryString = await getQueryStringWithSignature(parameters);

        const keys = await getKeys();
        const headers = { 'X-MBX-APIKEY': keys.api_key };
        const response = await axios.get(`https://api.binance.com/api/v3/account?${queryString}`, { headers });

        fs.writeFileSync(accountInfo_file, JSON.stringify(response.data));
        console.log('账户信息已成功写入文件');

        let totalSum = 0;
        const accountData = response.data;
        const positions = accountData.balances.filter(balance => parseFloat(balance.free) > 0);

        for (const position of positions) {
            const price = await fetchPrice(position.asset);
            if (price !== 'N/A') {
                totalSum += parseFloat(position.free) * parseFloat(price);
            }
        }

        const today = new Date().toISOString().split('T')[0];
        const totalAssetsFilePath = totalAssets_file;
        let totalAssetsData = [];

        if (fs.existsSync(totalAssetsFilePath)) {
            totalAssetsData = JSON.parse(fs.readFileSync(totalAssetsFilePath, 'utf8'));
        }

        const existingEntryIndex = totalAssetsData.findIndex(entry => entry.date === today);
        if (existingEntryIndex !== -1) {
            totalAssetsData[existingEntryIndex].total = totalSum.toFixed(2);
        } else {
            totalAssetsData.push({ date: today, total: totalSum.toFixed(2) });
        }

        // console.log('即将保存的每日资产总额数据：', totalAssetsData);
        fs.writeFileSync(totalAssetsFilePath, JSON.stringify(totalAssetsData));
        console.log('每日资产总额已更新');
    } catch (error) {
        console.error('获取账户信息或处理资产总额时发生错误：', error);
    }
}

// 检查数据库中是否存在有效密钥
async function checkKeysExist(req, res, next) {
    try {
        console.log("检查密钥...");
        const row = await getKeys();  // 使用 getKeys 函数获取密钥
        console.log("从数据库获取的密钥：", row);

        if (!row || !row.api_key || !row.secret_key) {
            console.log("未找到有效的密钥，重定向到首页...");
            res.send(`
                <p>未设置密钥。3 秒后将自动跳转到首页进行设置。</p>
                <script>
                    setTimeout(function() {
                        window.location.href = '/';
                    }, 3000);
                </script>
            `);
        } else {
            console.log("找到有效密钥，继续处理请求...");
            next();
        }
    } catch (error) {
        console.error('检查密钥时发生错误：', error);
        res.status(500).send('检查密钥时发生内部错误');
    }
}


// 定义根路由，用于设置 API 密钥和展示其他功能链接
app.get('/', async (req, res) => {
    try {
        const keys = await getKeys();
        let apiKeyPlaceholder = '';
        let secretKeyPlaceholder = '';

        // 检查是否已经存在 API 密钥和秘密密钥
        if (keys.api_key) {
            apiKeyPlaceholder = keys.api_key.slice(-10); // 获取 API 密钥的后 10 位
        }
        if (keys.secret_key) {
            secretKeyPlaceholder = keys.secret_key.slice(-10); // 获取秘密密钥的后 10 位
        }

        // 构建 HTML 页面
        let html = `<!DOCTYPE html>
        <html><head><title>币安资产监控平台</title></head><body>
        <h1>欢迎来到币安资产监控平台</h1>
        <hr>
        <form action="/setKeys" method="post">
            API Key: <input type="text" name="apiKey" placeholder="${apiKeyPlaceholder}" onclick="this.placeholder = ''" /><br>
            Secret Key: <input type="text" name="secretKey" placeholder="${secretKeyPlaceholder}" onclick="this.placeholder = ''" /><br>
            <input type="submit" value="设置密钥" />
            <button type="button" onclick="window.location.href='/clearKeys'">清除密钥</button>
        </form>
        <hr>
        <p><a href="/getAccountInfo/position">查看账户信息</a></p>
        <p><a href="/showChart">查看资产图表</a></p>
        </body></html>`;

        res.send(html);
    } catch (error) {
        console.error('在根路由处理时发生错误：', error);
        res.status(500).send('服务器内部错误');
    }
});

// 清除密钥的路由处理
app.get('/clearKeys', async (req, res) => {
    try {
        // 执行删除密钥的 SQL 语句
        await db.run("DELETE FROM keys");
        
        // 清除成功后，发送回应并自动跳转到首页
        res.send(`
            <p>密钥已清除。3 秒后将自动跳转到首页。</p>
            <script>
                setTimeout(function() {
                    window.location.href = '/';
                }, 3000);
            </script>
        `);
    } catch (error) {
        console.error('清除密钥时发生错误：', error);
        res.status(500).send('服务器错误：无法清除密钥');
    }
});

// 处理密钥设置请求，并在 3 秒后自动跳转
app.post('/setKeys', (req, res) => {
    const { apiKey, secretKey } = req.body;
    db.run(`INSERT INTO keys (api_key, secret_key) VALUES (?, ?)`, [apiKey, secretKey], (err) => {
        if (err) {
            res.status(500).send('保存密钥时发生错误');
            return console.error(err.message);
        }
        res.send(`密钥已更新，3 秒后自动跳转。<script>setTimeout(() => { window.location.href = '/'; }, 3000);</script>`);
    });
});

// 使用中间件在路由处理之前检查密钥
app.use('/getAccountInfo/position', checkKeysExist);
app.use('/showChart', checkKeysExist);

// 设置定时任务
setInterval(fetchAndSaveAccountInfo, 3000); // 每 3 秒执行一次


// 定义 '/getAccountInfo/position' 路由
app.get('/getAccountInfo/position', async (req, res) => {
    try {
        const accountData = JSON.parse(fs.readFileSync(accountInfo_file, 'utf8'));
        const positions = accountData.balances.filter(balance => parseFloat(balance.free) > 0);

        let html = '<!DOCTYPE html><html><head><title>账户余额及价格</title></head><body>';
        html += '<h1>账户余额及价格</h1>';
        html += '<label><input type="checkbox" id="hideSmallAssetsCheckbox" onclick="toggleSmallAssets()">隐藏小额资产</label>';
        html += '<table border="1" id="balancesTable"><tr><th>资产</th><th>可用余额</th><th>锁定余额</th><th>价格 (USDT)</th><th>合计</th></tr>';

        let totalSum = 0;
        for (const position of positions) {
            const price = await fetchPrice(position.asset);
            const total = price !== 'N/A' ? (parseFloat(position.free) * parseFloat(price)).toFixed(2) : 'N/A';
            if (total !== 'N/A') {
                totalSum += parseFloat(total);
                html += `<tr class="assetRow" data-total="${total}"><td>${position.asset}</td><td>${position.free}</td><td>${position.locked}</td><td>${price}</td><td>${total}</td></tr>`;
            }
        }

        html += `<tr><td colspan="4">合计总额</td><td>${totalSum.toFixed(2)}</td></tr>`;
        html += '</table>';
        html += `
        <script>
            function toggleSmallAssets() {
                var checkbox = document.getElementById('hideSmallAssetsCheckbox');
                var rows = document.querySelectorAll('.assetRow');
                var isHidden = checkbox.checked;
                rows.forEach(row => {
                    var total = parseFloat(row.getAttribute('data-total'));
                    if (!isNaN(total) && total < 1) {
                        row.style.display = isHidden ? 'none' : '';
                    }
                });
            }
        </script>`;
        // html += '</body></html>';
        html += '</body><p><a href="/">返回首页</a></p></html>';
        res.send(html);
    } catch (error) {
        console.error('读取账户信息时发生错误', error);
        res.status(500).send('读取账户信息时发生错误');
    }

});

// 显示图表 /showChart 路由
app.get('/showChart', (req, res) => {
    try {
        const totalAssetsData = JSON.parse(fs.readFileSync(totalAssets_file, 'utf8'));
        const dates = totalAssetsData.map(entry => entry.date);
        let totals = totalAssetsData.map(entry => parseFloat(entry.total));

        let html = '<!DOCTYPE html><html><head><title>币安资产总额图表</title>';
        html += '<script src="https://cdn.jsdelivr.net/npm/chart.js@2.9.4"></script>';
        html += '<style>#chartContainer { width: 80%; height: 70%; margin: auto; resize: both; overflow: auto; border: 1px solid black; }';
        html += 'h1 { text-align: center; }</style></head><body>';
        html += '<h1>币安资产总额图表</h1><div id="chartContainer"><canvas id="assetsChart"></canvas></div>';
        html += `
        <script>
            var ctx = document.getElementById('assetsChart').getContext('2d');
            var chartData = ${JSON.stringify(totals)};
            var animatedData = [];
            var totalSteps = chartData.length * 10;
            var currentStep = 0;

            var chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ${JSON.stringify(dates)},
                    datasets: [{
                        label: '资产总额',
                        data: animatedData,
                        backgroundColor: 'rgba(0, 123, 255, 0.5)',
                        borderColor: 'rgba(0, 123, 255, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        yAxes: [{
                            ticks: {
                                beginAtZero: true,
                                stepSize: 50
                            },
                            scaleLabel: {
                                display: true,
                                labelString: '美元 (USDT)'
                            }
                        }],
                        xAxes: [{
                            scaleLabel: {
                                display: true,
                                labelString: '日期 (Date)'
                            }
                        }]
                    },
                    animation: {
                        duration: 1200,
                        onProgress: function(animation) {
                            var frame = Math.floor(totalSteps * animation.currentStep / animation.numSteps);
                            var newStep = Math.floor(frame / 10);
                            if (newStep > currentStep) {
                                for (let i = currentStep; i <= newStep && i < chartData.length; i++) {
                                    animatedData[i] = chartData[i];
                                }
                                currentStep = newStep;
                                chart.update();
                            }
                        }
                    }
                }
            });
        </script>`;
        // 在 HTML 中增加一个返回首页的链接        
        html += '<p><a href="/">返回首页</a></p>';
        res.send(html);
    } catch (error) {
        console.error('生成图表时发生错误', error);
        res.status(500).send('生成图表时发生错误');
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port} 上`);
});
