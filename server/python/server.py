#! /usr/bin/env python3.6

"""
server.py
Stripe Sample.
Python 3.6 or newer required.
"""

import json
import os
import random
import string

import stripe
from dotenv import load_dotenv, find_dotenv
from flask import Flask, jsonify, render_template, redirect, request, session, send_from_directory, Response
import urllib

# Setup Stripe python client library
load_dotenv(find_dotenv())
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
stripe.api_version = os.getenv('STRIPE_API_VERSION', '2019-12-03')

static_dir = str(os.path.abspath(os.path.join(__file__ , "..", os.getenv("STATIC_DIR"))))
app = Flask(__name__, static_folder=static_dir,
            static_url_path="", template_folder=static_dir)

# Set the secret key to some random bytes. Keep this really secret!
# This enables Flask sessions.
app.secret_key = b'_5#y2L"F4Q8z\n\xec]/'

@app.route('/', methods=['GET'])
def get_example():
    return render_template('index.html')

@app.route("/transfer", methods=["POST"])
def transfer():
  data = json.loads(request.data)

  transfer = stripe.Transfer.create(
    amount=data['amount'],
    currency='usd',
    destination=data['account'],
  )

  return jsonify({
    'transfer': transfer
  })

def get_balance_usd():
  balance = stripe.Balance.retrieve()
  try:
    usd_balance = next(b for b in balance['available'] if b['currency'] == 'usd')['amount']
  except StopIteration:
    usd_balance = 0

  return {
    'balance': usd_balance
  }

@app.route("/platform-balance", methods=["GET"])
def platform_balance():
  return jsonify(get_balance_usd())

@app.route("/add-platform-balance", methods=["POST"])
def add_platform_balance():
  data = json.loads(request.data)

  try:
    stripe.Topup.create(
      amount=data['amount'],
      currency='usd',
      description='Stripe sample top-up',
      statement_descriptor='Stripe sample',
    )

  except stripe.error.StripeError as e:
    return jsonify({'error': str(e)})

  return jsonify(get_balance_usd())

@app.route("/recent-accounts", methods=["GET"])
def get_accounts():
    accounts = stripe.Account.list(limit=10)
    return jsonify({'accounts': accounts})

@app.route("/express-dashboard-link", methods=["GET"])
def get_express_dashboard_link():
    account_id = request.args.get('account_id')
    link = stripe.Account.create_login_link(account_id, redirect_url=(request.url_root))
    return jsonify({'url': link.url})

if __name__== '__main__':
    app.run(port=4242)
