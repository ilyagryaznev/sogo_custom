// redirect to mailcow login form
document.addEventListener('DOMContentLoaded', function () {
  var loginForm = document.forms.namedItem('loginForm');
  if (loginForm) {
    window.location.href = '/user';
  }
});

// logout function
function mc_logout() {
  fetch('/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'logout=1'
  }).then(function () {
    window.location.href = '/';
  });
}
