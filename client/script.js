/* ------- Making a transfer ------- */

document.querySelector("#transfer-form").addEventListener(
  "submit",
  event => {
    event.preventDefault();

    const amount = document.querySelector("#amount-input").value * 100;
    if (!amount) {
      const amountError = document.querySelector("#amount-error");
      amountError.innerHTML = 'Please specify a non-zero amount to transfer.';
      amountError.classList.remove('hidden');
      return;
    }
    if (!validateSufficientFunds()) {
      return;
    }

    changeLoadingState(true);

    fetch("/transfer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        account: document.querySelector("#enabled-accounts-select").value,
        amount,
      })
    })
      .then(response => response.json())
      .then(data => {
        transferComplete(data.transfer.id);
      });
  }
)

var transferComplete = function(transferId) {
  document.querySelector(".sr-transfer-form").classList.add("hidden");
  document.querySelector("#platform-balance-section").classList.add("hidden");
  document.querySelector(".sr-result").innerHTML = `<div>Transfer successful. <a href="https://dashboard.stripe.com/test/connect/transfers/${transferId}">View in dashboard</a></div>`;
  document.querySelector(".sr-result").classList.remove("hidden");
  changeLoadingState(false);
};

function validateSufficientFunds() {
  const amountError = document.querySelector("#amount-error");
  const submitButton = document.querySelector("#submit");
  if (window.balance != null && document.querySelector("#amount-input").value * 100 > window.balance) {
    amountError.innerHTML = "Amount to transfer cannot exceed balance."
    amountError.classList.remove("hidden");
    submitButton.disabled = true;
    return false;
  } else {
    amountError.classList.add("hidden");
    submitButton.disabled = false;
    return true;
  }
} 
document.querySelector("#amount-input").addEventListener(
  "change",
  _ => {
    validateSufficientFunds();
  }
)

/* ------- Platform balance and top-ups ------- */

function setBalance(balance) {
  window.balance = balance;
  document.querySelector("#balance-amount").innerHTML = "$" + balance / 100;
  document.querySelector("#balance-add").classList.remove("hidden");
}

fetch("/platform-balance", {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  })
  .then(response => response.json())
  .then(data => {
    setBalance(data.balance);
    document.querySelector("#balance-add").addEventListener(
      "click",
      event => {
        event.preventDefault();
        document.querySelector("#balance-amount").innerHTML = "(updating...)";
        document.querySelector("#balance-add").classList.add("hidden");
        fetch("/add-platform-balance", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({amount: 1000}),
        })
          .then(response => response.json())
          .then(d => {
            if (d.error) {
              const topUpError = document.querySelector("#top-up-error");
              topUpError.innerHTML = d.error + " Hint: make sure you've fulfilled the <a href=\"https://stripe.com/docs/connect/top-ups#requirements\">requirements for top-ups</a>."
              topUpError.classList.remove("hidden");
              document.querySelector("#balance-amount").innerHTML = "$" + window.balance / 100;
              return;
            }
            setBalance(d.balance)
            validateSufficientFunds();
          });
      }
    );
  });

/* ------- Loading helper ------- */

// Show a spinner on payment submission
var changeLoadingState = function(isLoading) {
  if (isLoading) {
    document.querySelector("button").disabled = true;
    document.querySelector("#transfer-spinner").classList.remove("hidden");
    document.querySelector("#button-text").classList.add("hidden");
  } else {
    document.querySelector("button").disabled = false;
    document.querySelector("#transfer-spinner").classList.add("hidden");
    document.querySelector("#button-text").classList.remove("hidden");
  }
};


/* ------- Account list ------- */

// Fetch 10 most recent accounts from the server. We'll display one of three states in the UI, depending on the
// accounts list; (1) if you haven't created any accounts, we'll re-direct you to the onboarding guide, (2) if none of
// of your accounts have charges enabled, we'll display instructions on how to finish the onboarding process, (3)
// otherwise, we'll display a payment form, as a customer might see it.
fetch("/recent-accounts", {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  })
  .then(response => response.json())
  .then(data => {
    document.querySelector("#account-spinner").classList.add("hidden");

    var accounts = data.accounts.data;

    // If there are no accounts, display a message pointing to an onboarding guide.
    if (!accounts.length) {
      document.querySelector("#no-accounts-section").classList.remove("hidden");
      return;
    }

    var enabledAccounts = accounts.filter((acct) => acct.charges_enabled && acct.country == 'US');

    // If no accounts are enabled, display instructions on how to enable an account. In an actual
    // application, you should only surface Express dashboard links to your connected account owners,
    // not to their customers.
    if (!enabledAccounts.length) {
      var expressAccounts = accounts.filter((acct) => acct.type == 'express');
      var hasCustom = !!accounts.filter((acct) => acct.type == 'custom');
      var hasStandard = !!accounts.filter((acct) => acct.type == 'standard');

      var wrapper = document.querySelector("#disabled-accounts-section");
      var input = document.querySelector("#disabled-accounts-select");
      expressAccounts.forEach((acct) => {
        var element = document.createElement("option");
        element.setAttribute("value", acct.id);
        element.innerHTML = acct.email || acct.id;
        input.appendChild(element)
      });
      // Remove the hidden CSS class on one of the sections with instruction on how to finish onboarding
      // for a given account type.
      if (expressAccounts.length) {
        document.querySelector('#disabled-accounts-form').classList.remove("hidden");
        wrapper.querySelector('.express').classList.remove("hidden");
      }
      else if (hasCustom) {
        wrapper.querySelector('.custom').classList.remove("hidden");
      }
      else if (hasStandard) {
        wrapper.querySelector('.standard').classList.remove("hidden");
      }
      wrapper.classList.remove("hidden");
      return;
    } 

    // If at least one account is enabled, show the account selector and payment form.
    var wrapper = document.querySelector("#enabled-accounts-section");
    var input = document.querySelector("#enabled-accounts-select");
    enabledAccounts.forEach((acct) => {
      var element = document.createElement("option");
      element.setAttribute("value", acct.id);
      element.innerHTML = acct.email || acct.id;
      input.appendChild(element)
    });
    wrapper.classList.remove("hidden");
    return;
  });


/* ------- Express dashboard ------- */

// When no accounts are enabled, this sample provides a way to log in as
// an Express account to finish the onboarding process. Here, we set up
// the event handler to construct the Express dashboard link.
expressDashboardForm = document.querySelector('#disabled-accounts-form');
expressDashboardForm.addEventListener(
  "submit",
  event => {
    event.preventDefault();
    button = expressDashboardForm.querySelector('button');
    button.setAttribute("disabled", "disabled");
    button.textContent = "Opening...";

    var url = new URL("/express-dashboard-link", document.baseURI);
    params = {account_id: document.querySelector("#disabled-accounts-select").value};
    url.search = new URLSearchParams(params).toString();

    fetch(url, {
      method: "GET",
      headers: {
      "Content-Type": "application/json"
      }
    })
      .then(response => response.json())
      .then(data => {
        if (data.url) {
          window.location = data.url;
        } else {
          elmButton.removeAttribute("disabled");
          elmButton.textContent = "<Something went wrong>";
          console.log("data", data);
        }
      });
  },
  false
);
