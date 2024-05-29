const axios = require('axios')
const { nim, password } = require('./config.json')
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const logger = require('./logger')
puppeteer.use(StealthPlugin())

const LMS = class {
    constructor() {
        this.page = null;
        this.browser = null;
        this.sesskey = null;
        this.logoutURL = null;
        this.moodleSession = null;
        this.username = nim;
        this.password = password;
        this.initialize();
    }
    async initialize() {
        try {
            logger.info('Starting!');
            this.browser = await puppeteer.launch({
                headless: 'new',
            });
            this.page = await this.browser.newPage();
            logger.info('Logging in to LMS...');
            await this.page.goto('https://lms.unikom.ac.id/login/index.php', { waitUntil: 'networkidle2' });
            await this.login();
            await this.getKey();
            await this.getCookie();
            await this.collectData();
        } catch (e) {
            logger.warn("Error during initialization: " + e.message);
        } finally {
            await this.logout();
        }
    }
    async login() {
        try {
            await this.page.type('#username', this.username);
            await this.page.type('#password', this.password);
            await this.page.click('#loginbtn');
            await this.page.waitForSelector('html');
            const invalidLogin = await this.page.evaluate(() => {
                return !!document.querySelector('#region-main > div > div > div > div > div > div.loginerrors');
              })
            if (invalidLogin) {
                throw new Error('Invalid login, please try again');
            } else {
                await this.page.waitForSelector('#action-menu-1-menu > a:nth-child(10)');
            }
        } catch (error) {
            throw error;
        }
    }
    async collectData() {
        try {
            if (this.sesskey && this.moodleSession) {
                const serviceData = await this.getServiceData();
                if (serviceData.length) {
                    serviceData.forEach(data => {
                        console.info(data);
                    });
                } else {
                    logger.warn('No upcoming activities due');
                }
            } else {
                logger.warn('Failed getting Cookie or Key');
            }
        } catch (e) {
            logger.warn('Error collecting data: ' + e.message);
        }
    }
    async getKey() {
        try {
            logger.info('Getting Key...');
            const logoutURL = await this.page.evaluate(() => {
                return document.querySelector('#action-menu-1-menu > a:nth-child(10)').getAttribute('href') ?? null;
            });
            if (logoutURL) {
                this.logoutURL = logoutURL;
                this.sesskey = new URLSearchParams(new URL(logoutURL).search).get('sesskey');
            } else {
                throw new Error('Logout URL not found');
            }
        } catch (e) {
            logger.warn('Error getting key: ' + e.message);
            throw e;
        }
    }

    async getCookie() {
        try {
            logger.info('Getting Cookie...');
            const cookies = await this.page.cookies();
            const moodleSessionCookie = cookies.find(cookie => cookie.name === 'MoodleSession');
            if (moodleSessionCookie) {
                this.moodleSession = moodleSessionCookie.value;
            } else {
                throw new Error('MoodleSession cookie not found');
            }
        } catch (e) {
            logger.warn('Error getting cookie: ' + e.message);
            throw e;
        }
    }
    async getServiceData() {
        const info = 'core_calendar_get_action_events_by_timesort';
        const url = `https://lms.unikom.ac.id/lib/ajax/service.php?sesskey=${this.sesskey}&info=${info}`;
        const payload = [
            {
                index: 0,
                methodname: info,
                args: {
                    limitnum: 6,
                    timesortfrom: 1715706000,
                    limittononsuspendedevents: true
                },
            }
        ];
        try {
            logger.info('Getting Service Data...');
            const response = await axios.post(
                url,
                payload,
                {
                    headers: {
                        'Accept': 'application/json, text/javascript, */*; q=0.01',
                        'Accept-Encoding': 'gzip, deflate, br, zstd',
                        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
                        'Connection': 'keep-alive',
                        'Content-Length': JSON.stringify(payload).length,
                        'Content-Type': 'application/json',
                        'Cookie': 'MoodleSession=' + this.moodleSession,
                        'Host': 'lms.unikom.ac.id',
                        'Origin': 'https://lms.unikom.ac.id',
                        'Referer': 'https://lms.unikom.ac.id/my/',
                        'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
                        'Sec-Ch-Ua-Mobile': '?0',
                        'Sec-Ch-Ua-Platform': '"Windows"',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-origin',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                }
            );
            return response.data[0].data.events;
        } catch (error) {
            console.error('Error fetching service data:', error);
            throw error;
        }
    }
    async logout() {
        if (this.browser) {
            try {
                if (this.logoutURL && !this.page.isClosed()) {
                    logger.info('Logging out from LMS...');
                    await this.page.goto(this.logoutURL, { waitUntil: 'networkidle2' }); // Logout from LMS
                    await this.page.waitForSelector('#tns1-item0 > div');
                }
            } catch (logoutError) {
                logger.warn('Error during logout: ' + logoutError.message);
            } finally {
                await this.browser.close();
                logger.warn('Browser closed.');
            }
        }
    }
}

new LMS();