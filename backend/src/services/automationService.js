const applyIpoForAccount = async (account, ipoDetails) => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        // --- LOGIN ---
        await page.goto('https://meroshare.cdsc.com.np/#/login');
        await page.select('#selectBank', account.dpid); 
        await page.type('input[name="username"]', account.username);
        await page.type('input[name="password"]', account.decryptedPassword);
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // --- NAVIGATE TO ASBA ---
        await page.goto('https://meroshare.cdsc.com.np/#/asba');
        await page.waitForSelector('.service-list-item'); // Wait for IPO list to load

        // --- SELECT TARGET IPO ---
        // We find the specific company row by searching for the text provided from frontend
        const targetApplied = await page.evaluate((companyName) => {
            const rows = Array.from(document.querySelectorAll('.service-list-item'));
            const targetRow = rows.find(row => row.innerText.includes(companyName));
            
            if (targetRow) {
                const applyBtn = targetRow.querySelector('.btn-apply');
                if (applyBtn) {
                    applyBtn.click();
                    return true;
                }
            }
            return false;
        }, ipoDetails.companyName);

        if (!targetApplied) throw new Error(`IPO for ${ipoDetails.companyName} not found or already applied.`);

        // --- FORM FILLING ---
        await page.waitForSelector('#kitta');
        await page.type('#kitta', ipoDetails.quantity.toString());
        await page.type('#crn', account.crn);
        await page.type('#pin', account.decryptedPin);
        
        // Finalize
        await page.click('input[type="checkbox"]'); 
        await page.click('.btn-primary'); // Submit
        
        return { success: true, boid: account.boid };
    } catch (error) {
        return { success: false, boid: account.boid, error: error.message };
    } finally {
        await browser.close();
    }
};