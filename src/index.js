const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const website = "https://bmvs.onlineappointmentscheduling.net.au"

async function scrapeWebsite() {
  let driver;

  try {
    // Set up Chrome options
    const options = new chrome.Options();
    if (!process.env.WINDOWS) {
        options.addArguments('--headless');
    }

    // Initialize the WebDriver
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    // Navigate to the website
    await driver.get(website);

    // Wait for the button to be present and clickable
    (await waitForElement(driver, By.id('ContentPlaceHolder1_btnInd'))).click();
    (await waitForElement(driver, By.id('ContentPlaceHolder1_SelectLocation1_txtSuburb')))
        .sendKeys(process.env.SUB || '2010');
    
    // Read the state value from environment variable
    const stateValue = process.env.STATE || 'NSW'; // Default to 'NSW' if not set

    // Select the state from the dropdown
    const stateDropdown = await waitForElement(driver, By.id('ContentPlaceHolder1_SelectLocation1_ddlState'));
    await driver.executeScript(`arguments[0].value = '${stateValue}';`, stateDropdown);
    await driver.executeScript("arguments[0].dispatchEvent(new Event('change'));", stateDropdown);

    await driver.executeScript("SearchPostCode();");
    // Wait for the table to be present
    const table = await waitForElement(driver, By.css('.tbl-location'));

    // Find all rows in the table
    const rows = await table.findElements(By.css('tr'));

    // Initialize an array to store the data
    const locations = [];

    // Iterate through each row (skipping the header row)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = await row.findElements(By.css('td'));
        
        // Extract text from each cell
        const rowData = await Promise.all(cells.map(cell => cell.getText()));
        const rowObject = {
            location: rowData[1],
            distance: parseInt(rowData[2]),
            firstAvailableDate: rowData[4],
            parsedFAD: parseFirstAvailableDate(rowData[4]),
        }
        
        // Add the row data to the locations array
        locations.push(rowObject);
    }

    // Sort locations by parsedFAD
    locations.sort((a, b) => {
        if (a.parsedFAD === null && b.parsedFAD === null) return 0;
        if (a.parsedFAD === null) return 1;
        if (b.parsedFAD === null) return -1;
        return a.parsedFAD - b.parsedFAD;
    });

    displayLocations(locations);

    // Wait for 10 seconds before closing
    // console.log('Waiting for 10 seconds before closing...');
    // await driver.sleep(10000);

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    // Close the browser
    if (driver) {
      await driver.quit();
    }
  }
}

async function waitForElement(driver, element) {
    return await driver.wait(until.elementLocated(element), 10000);
}

function parseFirstAvailableDate(dateString) {
    if (dateString.trim() === 'No available slot') {
        return null;
    }

  // Extract date and time parts
  const [datePart, timePart] = dateString.split('\n');
  
  // Extract day, month, year
  const [, day, month, year] = datePart.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  
  // Extract hours and minutes
  const [time, period] = timePart.split(' ');
  let [hours, minutes] = time.split(':');
  
  // Convert to 24-hour format if PM
  if (period === 'PM' && hours !== '12') {
    hours = String(parseInt(hours) + 12);
  } else if (period === 'AM' && hours === '12') {
    hours = '00';
  }
  
  // Create and return Date object
  return new Date(`${year}-${month}-${day}T${hours}:${minutes}:00`);
}

function displayLocations(locations) {
  console.log('Available Locations:');
  console.log('===================');
  
  locations.forEach((loc, index) => {
    console.log(`${index + 1}. ${loc.location}`);
    console.log(`   Distance: ${loc.distance} km`);
    console.log(`   First Available: ${loc.parsedFAD ? formatDate(loc.parsedFAD) : 'No available slot'}`);
    console.log('-------------------');
  });
}

function formatDate(date) {
  if (!date) return 'No available slot';
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return date.toLocaleDateString('en-US', options);
}

scrapeWebsite();
