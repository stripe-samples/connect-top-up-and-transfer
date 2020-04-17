# frozen_string_literal: true

require 'stripe'
require 'sinatra'
require 'dotenv'

# Replace if using a different env file or config
Dotenv.load
Stripe.api_key = ENV['STRIPE_SECRET_KEY']

enable :sessions
set :static, true
set :public_folder, File.join(File.dirname(__FILE__), ENV['STATIC_DIR'])
set :port, 4242

helpers do
  def request_headers
    env.each_with_object({}) { |(k, v), acc| acc[Regexp.last_match(1).downcase] = v if k =~ /^http_(.*)/i; }
  end
end

get '/' do
  content_type 'text/html'
  send_file File.join(settings.public_folder, 'index.html')
end

post '/transfer' do
  data = JSON.parse(request.body.read)

  transfer = Stripe::Transfer.create({
    amount: data['amount'],
    currency: 'usd',
    destination: data['account'],
  })

  {
    transfer: transfer
  }.to_json
end

def get_balance_usd
  balance = Stripe::Balance.retrieve()
  usd_balance = balance['available'].find {|b| b['currency'] == 'usd'} || {'amount' => 0}
  {
    balance: usd_balance['amount']
  }
end

get '/platform-balance' do
  get_balance_usd.to_json
end

post '/add-platform-balance' do
  data = JSON.parse(request.body.read)

  begin
    Stripe::Topup.create({
      amount: data['amount'],
      currency: 'usd',
      description: 'Stripe sample top-up',
      statement_descriptor: 'Stripe sample',
    })
  rescue Stripe::StripeError => e
    return {error: e}.to_json
  end

  get_balance_usd.to_json
end

get '/recent-accounts' do
  accounts = Stripe::Account.list({limit: 10})
  {'accounts': accounts}.to_json
end

get '/express-dashboard-link' do
  account_id = params[:account_id]
  link = Stripe::Account.create_login_link(account_id, redirect_url: (request.base_url))
  {'url': link.url}.to_json
end