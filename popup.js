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
    let issueKeyMatch = url.match(/browse\/([A-Z]+-\d+)/);
    if (!issueKeyMatch) {
        issueKeyMatch = url.match(/[?&]selectedIssue=([A-Z]+-\d+)/);
    }
    
    if (issueKeyMatch && issueKeyMatch[1]) {
      folderNameInput.value = issueKeyMatch[1];
    } else {
      folderNameInput.value = 'cdn_downloads';
    }

    scanForLinks(tabs[0].id);
  });

  function scanForLinks(tabId) {
    statusDiv.textContent = 'Scanning page for CDN links...';
  
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: findCdnLinks
    }, function (results) {
      if (chrome.runtime.lastError) {
        statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
        return;
      }

      cdnLinks = results[0].result;
      
      if (cdnLinks.length > 0) {
        statusDiv.innerHTML = `Found <span id="linkCount">${cdnLinks.length}</span> CDN links.`;
        downloadButton.disabled = false;
        downloadButton.innerHTML = 'Download All Files';
        applyFilterButton.disabled = false;

        // Extract unique file extensions
        const fileTypes = new Set();
        cdnLinks.forEach(link => {
          const parts = link.split('.');
          if (parts.length > 1) {
            const ext = parts.pop().split('?')[0].toLowerCase();
            if (/^[a-z0-9]+$/.test(ext)) { // Ensure it's a valid file extension
              fileTypes.add(ext);
            }
          }
        });

        // Populate checklist
        const checklistDiv = document.getElementById('fileTypeChecklist');
        checklistDiv.innerHTML = ''; // Clear previous list

        fileTypes.forEach(type => {
          const div = document.createElement('div');
          div.classList.add('file-type-option'); // Apply a class for styling

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = type;
          checkbox.id = `filetype-${type}`;
          if (!type.match('xml'))
            checkbox.checked = 'checked';

          const label = document.createElement('label');
          label.htmlFor = `filetype-${type}`;
          label.textContent = type;

          div.appendChild(checkbox);
          div.appendChild(label);
          checklistDiv.appendChild(div);
        });

      } else {
        statusDiv.textContent = 'No CDN links found on this page.';
        applyFilterButton.disabled = true;
        downloadButton.disabled = true;
      }
    });
  }

  scanButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      scanForLinks(tabs[0].id);
    });
  });

  scanButton.addEventListener('click', function () {
    statusDiv.textContent = 'Scanning page for CDN links...';
  
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: findCdnLinks
      }, function (results) {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
          return;
        }
  
        cdnLinks = results[0].result;
        
        if (cdnLinks.length > 0) {
          statusDiv.innerHTML = `Found <span id="linkCount">${cdnLinks.length}</span> CDN links.`;
          downloadButton.disabled = false;
          downloadButton.innerHTML = 'Download All Files';
          applyFilterButton.disabled = false;
  
          // Extract unique file extensions
          const fileTypes = new Set();
          cdnLinks.forEach(link => {
            const parts = link.split('.');
            if (parts.length > 1) {
              const ext = parts.pop().split('?')[0].toLowerCase();
              if (/^[a-z0-9]+$/.test(ext)) { // Ensure it's a valid file extension
                fileTypes.add(ext);
              }
            }
          });
  
          // Populate checklist
          const checklistDiv = document.getElementById('fileTypeChecklist');
          checklistDiv.innerHTML = ''; // Clear previous list

          fileTypes.forEach(type => {
            const div = document.createElement('div');
            div.classList.add('file-type-option'); // Apply a class for styling

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = type;
            checkbox.id = `filetype-${type}`;
            if (!type.match('xml'))
              checkbox.checked = 'checked';

            const label = document.createElement('label');
            label.htmlFor = `filetype-${type}`;
            label.textContent = type;

            div.appendChild(checkbox);
            div.appendChild(label);
            checklistDiv.appendChild(div);
          });
  
        } else {
          statusDiv.textContent = 'No CDN links found on this page.';
          applyFilterButton.disabled = true;
          downloadButton.disabled = true;
        }
      });
    });
  });

  applyFilterButton.addEventListener('click', function () {
    const selectedTypes = Array.from(document.querySelectorAll('#fileTypeChecklist input:checked'))
      .map(checkbox => checkbox.value);
  
    if (selectedTypes.length === 0) {
      statusDiv.textContent = 'Please select at least one file type!';
      return;
    }
  
    const filteredLinks = cdnLinks.filter(link => {
      const tokens = link.split('/');
      const lastToken = tokens[tokens.length - 1];
      const ext = lastToken.includes('.') ? lastToken.split('.').pop().split('?')[0].toLowerCase() : '';
      return selectedTypes.includes(ext) || !lastToken.includes('.');
    });
  
    if (filteredLinks.length > 0) {
      statusDiv.innerHTML = `Filtered <span id="linkCount">${filteredLinks.length}</span> files. Ready to download.`;
      cdnLinks = filteredLinks;
      downloadButton.disabled = false;
      downloadButton.innerHTML = 'Download Filtered Files';
    } else {
      statusDiv.textContent = 'No matching files found!';
      downloadButton.disabled = true;
    }
  });  

  downloadButton.addEventListener('click', function () {
    const folderName = folderNameInput.value || 'cdn_downloads';
  
    if (cdnLinks.length === 0) {
      statusDiv.textContent = 'No links to download.';
      return;
    }
  
    statusDiv.textContent = 'Starting downloads...';
    let downloadCount = 0;
  
    cdnLinks.forEach((link, index) => {
      const filename = link.split('/').pop().split('?')[0];
  
      chrome.downloads.download({
        url: link,
        filename: `${folderName}/${filename}`,
        conflictAction: 'uniquify'
      }, function (downloadId) {
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
    if (href) {
      if (href.startsWith('https://cdn')) {
        cdnLinks.push(href);
      } else if (href.startsWith('https://configura.zendesk.com/attachments')) {
        cdnLinks.push(href);
      }
    }
  });
  
  // Also check for images, scripts, and other resources
  // const images = document.querySelectorAll('img');
  // images.forEach(img => {
  //   const src = img.src;
  //   if (src && src.startsWith('https://cdn')) {
  //     cdnLinks.push(src);
  //   }
  // });
  
  // const scripts = document.querySelectorAll('script');
  // scripts.forEach(script => {
  //   const src = script.src;
  //   if (src && src.startsWith('https://cdn')) {
  //     cdnLinks.push(src);
  //   }
  // });
  
  // Remove duplicates
  return [...new Set(cdnLinks)];
}
