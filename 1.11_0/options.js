function isFirefox() {
  return !chrome.storage;
}

function saveToStorage(key, value) {
  if (isFirefox()) {
    return new Promise((resolve) => {
      browser.storage.sync.set({
        [key]: value
      })
      resolve()
    })
  } else {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [key]: value }, function() {
        resolve()
      });
    })
  }
}
  
function getFromStorage(key, defaultValue) {
  if (isFirefox()) {
    return new Promise((resolve) => {
      browser.storage.sync.get(key).then(function(results) {
        if (results[key] === undefined) {
          return resolve(defaultValue);
        }
        return resolve(results[key]);
      })
    })
  } else {
    return new Promise((resolve) => {
      chrome.storage.sync.get(key, function(results) {
        if (results[key] === undefined) {
          return resolve(defaultValue);
        }
        return resolve(results[key]);
      });
    })
  }
}

// Saves options to chrome.storage
const saveOptions = () => {
  const orientation = document.getElementById('orientation').value;

  saveToStorage("orientation", orientation).then(function() {
    const status = document.getElementById('status');
    // Update status to let user know options were saved.
    status.textContent = 'Options saved.';
    setTimeout(() => {
        status.textContent = '';
    }, 750);
  })
  
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
  getFromStorage('orientation', 'previous').then(function(result) {
    document.getElementById('orientation').value = result;
  })
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);



