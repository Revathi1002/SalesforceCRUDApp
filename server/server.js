const express = require("express");
const cors = require("cors");
const axios = require("axios");
const session = require("express-session");
const crypto = require("crypto");

require("dotenv").config();

const app = express();


// ==========================================
// RENDER PROXY
// ==========================================

app.set("trust proxy", 1);


// ==========================================
// MIDDLEWARE
// ==========================================

app.use(express.json());

app.use(
    cors({
        origin: "https://salesforcecrud-frontend.onrender.com",
        credentials: true
    })
);

app.use(
    session({
        secret: "salesforce-crud-session-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: true,
            sameSite: "none"
        }
    })
);


// ==========================================
// SALESFORCE API VERSION
// ==========================================

const API_VERSION = "v66.0";


// ==========================================
// SALESFORCE OBJECTS AND FIELDS
// ==========================================

const OBJECT_FIELDS = {

    Account: [
        "Id",
        "Name",
        "Phone",
        "Website",
        "Industry",
        "Type"
    ],

    Opportunity: [
        "Id",
        "Name",
        "Amount",
        "StageName",
        "CloseDate",
        "AccountId"
    ],

    Lead: [
        "Id",
        "FirstName",
        "LastName",
        "Company",
        "Email",
        "Phone",
        "Status"
    ],

    Contact: [
        "Id",
        "FirstName",
        "LastName",
        "Email",
        "Phone",
        "AccountId"
    ],

    Case: [
        "Id",
        "CaseNumber",
        "Subject",
        "Status",
        "Priority",
        "AccountId"
    ]
};


// ==========================================
// SALESFORCE LOGIN - PKCE
// ==========================================

app.get("/auth/login", (req, res) => {

    console.log("=================================");
    console.log("OAUTH LOGIN HIT");
    console.log("Client ID exists:",
        !!process.env.SALESFORCE_CLIENT_ID
    );
    console.log(
        "Client ID length:",
        process.env.SALESFORCE_CLIENT_ID?.length
    );
    console.log(
        "Login URL:",
        process.env.SALESFORCE_LOGIN_URL
    );
    console.log(
        "Callback URL:",
        process.env.SALESFORCE_CALLBACK_URL
    );
    console.log("=================================");


    // Create PKCE code verifier

    const codeVerifier = crypto
        .randomBytes(32)
        .toString("base64url");


    // Create PKCE code challenge

    const codeChallenge = crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");


    // Store verifier in session

    req.session.codeVerifier = codeVerifier;


    // Salesforce OAuth parameters

    const params = new URLSearchParams({

        response_type: "code",

        client_id:
            process.env.SALESFORCE_CLIENT_ID,

        redirect_uri:
            process.env.SALESFORCE_CALLBACK_URL,

        scope:
            "api refresh_token",

        code_challenge:
            codeChallenge,

        code_challenge_method:
            "S256"
    });


    // Create Salesforce login URL

    const loginUrl =
        `${process.env.SALESFORCE_LOGIN_URL}/services/oauth2/authorize?${params.toString()}`;


    console.log(
        "Redirecting to Salesforce OAuth"
    );


    // IMPORTANT:
    // Redirect to Salesforce, NOT frontend

    res.redirect(loginUrl);
});


// ==========================================
// OAUTH CALLBACK
// ==========================================

app.get("/oauth/callback", async (req, res) => {

    console.log("=================================");
    console.log("OAUTH CALLBACK HIT");
    console.log("=================================");


    const { code } = req.query;


    if (!code) {

        return res.status(400).send(
            "Authorization code not received."
        );
    }


    const codeVerifier =
        req.session.codeVerifier;


    if (!codeVerifier) {

        return res.status(400).send(
            "PKCE code verifier not found."
        );
    }


    try {

        console.log(
            "Exchanging authorization code for token..."
        );


        const response = await axios.post(

            `${process.env.SALESFORCE_LOGIN_URL}/services/oauth2/token`,

            new URLSearchParams({

                grant_type:
                    "authorization_code",

                code:
                    code,

                client_id:
                    process.env.SALESFORCE_CLIENT_ID,

                client_secret:
                    process.env.SALESFORCE_CLIENT_SECRET,

                redirect_uri:
                    process.env.SALESFORCE_CALLBACK_URL,

                code_verifier:
                    codeVerifier

            }).toString(),

            {
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                }
            }
        );


        // Store Salesforce session

        req.session.salesforce = {

            accessToken:
                response.data.access_token,

            refreshToken:
                response.data.refresh_token,

            instanceUrl:
                response.data.instance_url
        };


        // Remove PKCE verifier

        delete req.session.codeVerifier;


        console.log(
            "Salesforce login successful"
        );


        // IMPORTANT:
        // Redirect to deployed React app

        res.redirect(
            "https://salesforcecrud-frontend.onrender.com"
        );

    } catch (error) {

        console.error(
            "========== OAUTH ERROR =========="
        );

        console.error(
            "Status:",
            error.response?.status
        );

        console.error(
            "Salesforce Error:",
            error.response?.data
        );

        console.error(
            "Message:",
            error.message
        );

        console.error(
            "================================="
        );


        res.status(500).json({

            message:
                "Salesforce authentication failed",

            error:
                error.response?.data ||
                error.message
        });
    }
});


// ==========================================
// LOGIN STATUS
// ==========================================

app.get("/auth/status", (req, res) => {

    if (req.session.salesforce) {

        return res.json({
            loggedIn: true
        });
    }


    res.json({
        loggedIn: false
    });
});


// ==========================================
// LOGOUT
// ==========================================

app.get("/auth/logout", (req, res) => {

    req.session.destroy((error) => {

        if (error) {

            return res.status(500).json({
                message: "Logout failed"
            });
        }


        res.json({
            message:
                "Logged out successfully"
        });

    });
});


// ==========================================
// GET SALESFORCE RECORDS
// ==========================================

app.get("/api/records", async (req, res) => {

    if (!req.session.salesforce) {

        return res.status(401).json({
            message:
                "Not logged in to Salesforce"
        });
    }


    const objectName =
        req.query.object;


    if (!OBJECT_FIELDS[objectName]) {

        return res.status(400).json({
            message:
                "Invalid Salesforce object"
        });
    }


    try {

        const {
            accessToken,
            instanceUrl
        } = req.session.salesforce;


        const fields =
            OBJECT_FIELDS[objectName].join(", ");


        const soql =
            `SELECT ${fields} FROM ${objectName} ORDER BY Id LIMIT 20`;


        const url =
            `${instanceUrl}/services/data/${API_VERSION}/query`;


        const response =
            await axios.get(

                url,

                {

                    params: {
                        q: soql
                    },

                    headers: {
                        Authorization:
                            `Bearer ${accessToken}`
                    }
                }
            );


        res.json({

            records:
                response.data.records,

            nextRecordsUrl:
                response.data.nextRecordsUrl ||
                null,

            totalSize:
                response.data.totalSize

        });

    } catch (error) {

        console.error(
            "Get records error:",
            error.response?.data ||
            error.message
        );


        res.status(500).json({

            message:
                "Failed to load Salesforce records",

            error:
                error.response?.data ||
                error.message
        });
    }
});


// ==========================================
// GET NEXT 20 RECORDS
// ==========================================

app.get(
    "/api/records/next",
    async (req, res) => {

        if (!req.session.salesforce) {

            return res.status(401).json({
                message:
                    "Not logged in to Salesforce"
            });
        }


        const nextUrl =
            req.query.url;


        if (!nextUrl) {

            return res.status(400).json({
                message:
                    "Next records URL is required"
            });
        }


        try {

            const {
                accessToken,
                instanceUrl
            } = req.session.salesforce;


            if (!nextUrl.startsWith(instanceUrl)) {

                return res.status(400).json({
                    message:
                        "Invalid Salesforce URL"
                });
            }


            const response =
                await axios.get(

                    nextUrl,

                    {

                        headers: {
                            Authorization:
                                `Bearer ${accessToken}`
                        }
                    }
                );


            res.json({

                records:
                    response.data.records,

                nextRecordsUrl:
                    response.data.nextRecordsUrl ||
                    null,

                totalSize:
                    response.data.totalSize

            });

        } catch (error) {

            console.error(
                "Next records error:",
                error.response?.data ||
                error.message
            );


            res.status(500).json({

                message:
                    "Failed to get more Salesforce records",

                error:
                    error.response?.data ||
                    error.message
            });
        }
    }
);


// ==========================================
// CREATE RECORD
// ==========================================

app.post(
    "/api/records",
    async (req, res) => {

        if (!req.session.salesforce) {

            return res.status(401).json({
                message:
                    "Not logged in to Salesforce"
            });
        }


        const objectName =
            req.body.object;

        const fields =
            req.body.fields;


        if (!OBJECT_FIELDS[objectName]) {

            return res.status(400).json({
                message:
                    "Invalid Salesforce object"
            });
        }


        try {

            const {
                accessToken,
                instanceUrl
            } = req.session.salesforce;


            const response =
                await axios.post(

                    `${instanceUrl}/services/data/${API_VERSION}/sobjects/${objectName}`,

                    fields,

                    {

                        headers: {

                            Authorization:
                                `Bearer ${accessToken}`,

                            "Content-Type":
                                "application/json"
                        }
                    }
                );


            res.json(response.data);

        } catch (error) {

            console.error(
                "Create error:",
                error.response?.data ||
                error.message
            );


            res.status(500).json({

                message:
                    "Failed to create Salesforce record",

                error:
                    error.response?.data ||
                    error.message
            });
        }
    }
);


// ==========================================
// UPDATE RECORD
// ==========================================

app.patch(
    "/api/records/:object/:id",
    async (req, res) => {

        if (!req.session.salesforce) {

            return res.status(401).json({
                message:
                    "Not logged in to Salesforce"
            });
        }


        const {
            object,
            id
        } = req.params;


        if (!OBJECT_FIELDS[object]) {

            return res.status(400).json({
                message:
                    "Invalid Salesforce object"
            });
        }


        try {

            const {
                accessToken,
                instanceUrl
            } = req.session.salesforce;


            await axios.patch(

                `${instanceUrl}/services/data/${API_VERSION}/sobjects/${object}/${id}`,

                req.body,

                {

                    headers: {

                        Authorization:
                            `Bearer ${accessToken}`,

                        "Content-Type":
                            "application/json"
                    }
                }
            );


            res.json({

                success: true,

                message:
                    "Record updated successfully"

            });

        } catch (error) {

            console.error(
                "Update error:",
                error.response?.data ||
                error.message
            );


            res.status(500).json({

                message:
                    "Failed to update Salesforce record",

                error:
                    error.response?.data ||
                    error.message
            });
        }
    }
);


// ==========================================
// DELETE RECORD
// ==========================================

app.delete(
    "/api/records/:object/:id",
    async (req, res) => {

        console.log(
            "DELETE ROUTE HIT"
        );


        if (!req.session.salesforce) {

            return res.status(401).json({
                message:
                    "Not logged in to Salesforce"
            });
        }


        const {
            object,
            id
        } = req.params;


        console.log(
            "DELETE REQUEST"
        );

        console.log(
            "Object:",
            object
        );

        console.log(
            "Record ID:",
            id
        );


        if (!OBJECT_FIELDS[object]) {

            return res.status(400).json({
                message:
                    "Invalid Salesforce object"
            });
        }


        try {

            const {
                accessToken,
                instanceUrl
            } = req.session.salesforce;


            const deleteUrl =
                `${instanceUrl}/services/data/${API_VERSION}/sobjects/${object}/${id}`;


            console.log(
                "Delete URL:",
                deleteUrl
            );


            await axios.delete(

                deleteUrl,

                {

                    headers: {
                        Authorization:
                            `Bearer ${accessToken}`
                    }
                }
            );


            console.log(
                "DELETE SUCCESS"
            );


            res.json({

                success: true,

                message:
                    "Record deleted successfully"

            });

        } catch (error) {

            console.error(
                "========== DELETE ERROR =========="
            );

            console.error(
                "Status:",
                error.response?.status
            );

            console.error(
                "Salesforce Error:",
                error.response?.data
            );

            console.error(
                "Message:",
                error.message
            );

            console.error(
                "================================="
            );


            res.status(500).json({

                message:
                    "Failed to delete Salesforce record",

                error:
                    error.response?.data ||
                    error.message

            });
        }
    }
);


// ==========================================
// START SERVER
// ==========================================

const PORT =
    process.env.PORT || 5000;


console.log(
    "Starting server..."
);


app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Server running at http://localhost:${PORT}`
        );

    }
);