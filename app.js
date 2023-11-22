// 导入依赖库和加载环境变量
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

// 从环境变量中获取 API 密钥和秘密密钥
const apiKey = process.env.API_KEY;
const secretKey = process.env.SECRET_KEY;

console.log(`API key: ${apiKey}`);
console.log(`secret key: ${secretKey}`);

// 创建 Express 应用实例
const app = express();
const port = process.env.PORT;

// 延迟函数，遵守 API 频率限制
function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

// 生成带签名的查询字符串
function getQueryStringWithSignature(parameters) {
    const queryString = Object.keys(parameters).map(key => key + '=' + parameters[key]).join('&');
    const signature = crypto.createHmac('sha256', secretKey).update(queryString).digest('hex');
    return queryString + '&signature=' + signature;
}

// 获取指定币种的最新价格
async function fetchPrice(asset) {
    try {
        // 特殊处理，USDT 的价格始终设为 1
        if (asset === 'USDT') {
            return '1';
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
        await delay(1000); // API 频率限制

        const parameters = {
            timestamp: Date.now(),
            recvWindow: 10000
        };

        const queryString = getQueryStringWithSignature(parameters);
        const headers = { 'X-MBX-APIKEY': apiKey };

        const response = await axios.get(`https://api.binance.com/api/v3/account?${queryString}`, { headers: headers });
        fs.writeFileSync('accountInfo.json', JSON.stringify(response.data));
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
        const totalAssetsFilePath = 'totalAssets.json';
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

        console.log('即将保存的每日资产总额数据：', totalAssetsData);
        fs.writeFileSync(totalAssetsFilePath, JSON.stringify(totalAssetsData));
        console.log('每日资产总额已更新');
    } catch (error) {
        console.error('获取账户信息或处理资产总额时发生错误：', error);
    }
}


// 设置定时任务
setInterval(fetchAndSaveAccountInfo, 3000); // 每小时执行一次

// 定义根路由
app.get('/', (req, res) => {
    res.send('Hello World!');
});

// 定义 '/getAccountInfo/position' 路由
app.get('/getAccountInfo/position', async (req, res) => {
    try {
        const accountData = JSON.parse(fs.readFileSync('accountInfo.json', 'utf8'));
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
        html += '</body></html>';
        res.send(html);
    } catch (error) {
        console.error('读取账户信息时发生错误', error);
        res.status(500).send('读取账户信息时发生错误');
    }
});

// 显示图表 /showChart 路由
app.get('/showChart', (req, res) => {
    try {
        const totalAssetsData = JSON.parse(fs.readFileSync('totalAssets.json', 'utf8'));
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
        html += '</body></html>';
        res.send(html);
    } catch (error) {
        console.error('生成图表时发生错误', error);
        res.status(500).send('生成图表时发生错误');
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在端口 ${port}`);
});
