<?php
use Slim\Http\Request;
use Slim\Http\Response;
use Stripe\Stripe;

require 'vendor/autoload.php';

$dotenv = Dotenv\Dotenv::create(__DIR__);
$dotenv->load();

require './config.php';

$app = new \Slim\App;

// Instantiate the logger as a dependency
$container = $app->getContainer();
$container['logger'] = function ($c) {
  $settings = $c->get('settings')['logger'];
  $logger = new Monolog\Logger($settings['name']);
  $logger->pushProcessor(new Monolog\Processor\UidProcessor());
  $logger->pushHandler(new Monolog\Handler\StreamHandler(__DIR__ . '/logs/app.log', \Monolog\Logger::DEBUG));
  return $logger;
};

$app->add(function ($request, $response, $next) {
    Stripe::setApiKey(getenv('STRIPE_SECRET_KEY'));
    return $next($request, $response);
});

$app->post("/transfer", function ($request, $response, $next) {
  $data = json_decode($request->getBody(), true);

  $transfer = \Stripe\Transfer::create([
    "amount" => $data['amount'],
    "currency" => "usd",
    "destination" => $data['account']
  ]);

  return $response->withJson(array(
    'transfer' => $transfer,
  ));
});

function isUsd($b) {
  return $b['currency'] == 'usd';
}

function getBalanceUsd() {
  $balance = \Stripe\Balance::retrieve();
  $usdBalance = array_filter($balance['available'], "isUsd")[0]['amount'];

  return array(
    'balance' => $usdBalance ? $usdBalance : 0
  );
}

$app->get("/platform-balance", function ($request, $response, $next) {
  return $response->withJson(getBalanceUsd());
});

$app->post("/add-platform-balance", function ($request, $response, $next) {
  $data = json_decode($request->getBody(), true);

  try {
    \Stripe\Topup::create([
      'amount' => $data['amount'],
      'currency' => 'usd',
      'description' => 'Stripe sample top-up',
      'statement_descriptor' => 'Stripe sample',
    ]);
  } catch (\Stripe\Error $e) {
    return $response->withJson(array(
      'error' => $e,
    ));
  }

  return $response->withJson(getBalanceUsd());
});

$app->get('/recent-accounts', function (Request $request, Response $response, array $args) {
  $accounts = \Stripe\Account::all(['limit' => 10]);
  return $response->withJson(array('accounts' => $accounts));
});

$app->get('/express-dashboard-link', function (Request $request, Response $response, array $args) {
  $account_id = $request->getQueryParam('account_id');
  $link = \Stripe\Account::createLoginLink(
    $account_id,
    ['redirect_url' => $request->getUri()->getBaseUrl()]
  );
  return $response->withJson(array('url' => $link->url));
});

$app->run();
