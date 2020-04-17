package com.stripe.sample;

import java.nio.file.Paths;

import java.util.HashMap;
import java.util.Map;

import static spark.Spark.get;
import static spark.Spark.post;
import static spark.Spark.port;
import static spark.Spark.staticFiles;

import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;
import com.stripe.Stripe;
import com.stripe.exception.*;

import io.github.cdimascio.dotenv.Dotenv;

import com.stripe.model.Balance;
import com.stripe.model.Topup;
import com.stripe.model.Transfer;
import com.stripe.model.Account;
import com.stripe.model.AccountCollection;
import com.stripe.model.LoginLink;
import com.stripe.exception.StripeException;
import com.stripe.param.TopupCreateParams;

public class Server {
    private static Gson gson = new Gson();

    static class CreateResponse {
        private String publishableKey;
        private String clientSecret;

        public CreateResponse(String publishableKey, String clientSecret) {
            this.publishableKey = publishableKey;
            this.clientSecret = clientSecret;
        }
    }

    static class TransferParams {
        private Long amount;
        private String account;
    }

    static class AddBalanceParams {
        private Long amount;
    }

    static class AccountsResponse {
        private AccountCollection accounts;

        public AccountsResponse(AccountCollection accounts) {
            this.accounts = accounts;
        }
    }

    static class LoginLinkResponse {
        private String url;

        public LoginLinkResponse(String url) {
            this.url = url;
        }
    }

    private static Map<String, Long> getBalanceUsd() {
        Map<String, Long> balanceUsd = new HashMap<>();

        try {
            Balance balance = Balance.retrieve();
            for (Balance.Money money : balance.getAvailable()) {
                if (money.getCurrency().equals("usd")) {
                    balanceUsd.put("balance", money.getAmount());
                    return balanceUsd;
                }
            }
        } catch (StripeException e) {
            // Handle the exception.
        }

        balanceUsd.put("balance", 0L);
        return balanceUsd;
    }

    public static void main(String[] args) {
        port(4242);
        Dotenv dotenv = Dotenv.load();
        Stripe.apiKey = dotenv.get("STRIPE_SECRET_KEY");
        staticFiles.externalLocation(
                Paths.get(Paths.get("").toAbsolutePath().toString(), dotenv.get("STATIC_DIR")).normalize().toString());

        get("/", (request, response) -> {
            response.type("application/json");

            Map<String, Object> responseData = new HashMap<>();
            responseData.put("some_key", "some_value");
            return gson.toJson(responseData);
        });

        post("/transfer", (request, response) -> {
            response.type("application/json");

            TransferParams data = gson.fromJson(request.body(), TransferParams.class);

            Map<String, Object> params = new HashMap<>();
            params.put("amount", data.amount);
            params.put("currency", "usd");
            params.put("destination", data.account);
            Transfer transfer = Transfer.create(params);

            Map<String, Transfer> responseData = new HashMap<>();
            responseData.put("transfer", transfer);
            return gson.toJson(responseData);
        });

        get("/platform-balance", (request, response) -> {
            response.type("application/json");
            return gson.toJson(getBalanceUsd());
        });

        post("/add-platform-balance", (request, response) -> {
            response.type("application/json");

            AddBalanceParams data = gson.fromJson(request.body(), AddBalanceParams.class);

            try {
                TopupCreateParams params =
                TopupCreateParams.builder()
                    .setAmount(data.amount)
                    .setCurrency("usd")
                    .setDescription("Stripe sample top-up")
                    .setStatementDescriptor("Stripe sample")
                    .build();

                Topup topup = Topup.create(params);
            }
            catch (StripeException e) {
                HashMap<String, String> responseData = new HashMap();
                responseData.put("error", e.toString());
                return gson.toJson(responseData);
            }

            return gson.toJson(getBalanceUsd());
        });

        get("/recent-accounts", (request, response) -> {
            Map<String, Object> params = new HashMap<>();
            params.put("limit", 10);
            AccountCollection accounts = Account.list(params);
            return gson.toJson(new AccountsResponse(accounts));
        });

        get("/express-dashboard-link", (request, response) -> {
            String accountId = request.queryParams("account_id");
            Map<String, Object> params = new HashMap<>();
            params.put("redirect_url", request.scheme() + "://" + request.host());
            LoginLink link = LoginLink.createOnAccount(accountId, params, null);
            return gson.toJson(new LoginLinkResponse(link.getUrl()));
        });
    }
}