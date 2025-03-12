// popup.js
document.addEventListener('DOMContentLoaded', function() {
  const scanButton = document.getElementById('scanButton');
  const downloadButton = document.getElementById('downloadButton');
  const statusDiv = document.getElementById('status');
  const folderNameInput = document.getElementById('folderName');
  let cdnLinks = [];

  // Get the current tab's URL to extract the Jira issue key
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const url = tabs[0].url;
    const issueKeyMatch = url.match(/browse\/([A-Z]+-\d+)/);
    
    if (issueKeyMatch && issueKeyMatch[1]) {
      folderNameInput.value = issueKeyMatch[1];
    } else {
      folderNameInput.value = 'cdn_downloads';
    }
  });

  scanButton.addEventListener('click', function() {
    statusDiv.textContent = 'Scanning page for CDN links...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: findCdnLinks
      }, function(results) {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
          return;
        }
        
        cdnLinks = results[0].result;
        
        if (cdnLinks.length > 0) {
          statusDiv.innerHTML = `Found <span id="linkCount">${cdnLinks.length}</span> CDN links.`;
          downloadButton.disabled = false;
        } else {
          statusDiv.textContent = 'No CDN links found on this page.';
          downloadButton.disabled = true;
        }
      });
    });
  });

  downloadButton.addEventListener('click', function() {
    const folderName = folderNameInput.value || 'cdn_downloads';
    
    if (cdnLinks.length === 0) {
      statusDiv.textContent = 'No links to download.';
      return;
    }
    
    statusDiv.textContent = 'Starting downloads...';
    let downloadCount = 0;
    
    cdnLinks.forEach((link, index) => {
      // Extract filename from URL
      const filename = link.split('/').pop().split('?')[0];
      
      chrome.downloads.download({
        url: link,
        filename: `${folderName}/${filename}`,
        conflictAction: 'uniquify'
      }, function(downloadId) {
        downloadCount++;
        statusDiv.textContent = `Downloading ${downloadCount}/${cdnLinks.length}...`;
        
        if (downloadCount === cdnLinks.length) {
          statusDiv.textContent = `All ${cdnLinks.length} files downloaded to folder "${folderName}"!`;
        }
      });
    });
  });
});

function findCdnLinks() {
  const links = document.querySelectorAll('a');
  const cdnLinks = [];
  
  links.forEach(link => {
    const href = link.href;
    if (href && href.startsWith('https://cdn')) {
      cdnLinks.push(href);
    }
  });
  
  // Also check for images, scripts, and other resources
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    const src = img.src;
    if (src && src.startsWith('https://cdn')) {
      cdnLinks.push(src);
    }
  });
  
  const scripts = document.querySelectorAll('script');
  scripts.forEach(script => {
    const src = script.src;
    if (src && src.startsWith('https://cdn')) {
      cdnLinks.push(src);
    }
  });
  
  // Remove duplicates
  return [...new Set(cdnLinks)];
}
