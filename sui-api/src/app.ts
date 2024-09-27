import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import * as middlewares from "./middlewares";
import api from "./api";
import MessageResponse from "./interfaces/MessageResponse";

require("dotenv").config();

BigInt.prototype.toJSON = function () {
  return this.toString();
};

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Sui OSS API",
      version: "1.0.0",
      description:
        "Sui OSS API is a RESTful API for the Sui OSS project. It is built with Node.js, Express, and TypeScript.",
      license: {
        name: "Licensed Under MIT",
        url: "https://spdx.org/licenses/MIT.html",
      },
      contact: {
        name: "Nimbus",
        url: "https://getnimbus.io",
        email: "toannhu@getnimbus.io",
      },
    },
    servers: [
      {
        url: "https://sui-oss-api.getnimbus.io/api",
        description: "Production server",
      },
    ],
  },
  apis: ["**/*.ts"],
};

const swaggerSpecs = swaggerJsdoc(options);

const app = express();

app.use(morgan("dev"));
app.use(helmet());
app.use(cors());
app.use(express.json());

// api docs
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, {
    explorer: true,
  })
);

app.get<{}, MessageResponse>("/", (req, res) => {
  res.json({
    message: "ok",
  });
});

app.use("/api/v1", api);

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

export default app;
