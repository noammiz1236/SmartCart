import "dotenv/config";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import http from "http";
import authRoutes from "./modules/auth/routes.js";
import productsRoutes from "./modules/products/routes.js";
import listsRoutes from "./modules/lists/routes.js";
import familyRoutes from "./modules/family/routes.js";
import kidRequestsRoutes from "./modules/kidRequests/routes.js";
import registerListSocketHandlers from "./modules/lists/socket.js";

const port = process.env.PORT;
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (process.env.CORS || "http://localhost:5173/").split(","),
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware הגדרות כלליות
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: (process.env.CORS || "http://localhost:5173/").split(","),
    credentials: true,
  }),
);

// Mounted routers
app.use("/api", authRoutes);
app.use("/api", productsRoutes);
app.use("/api", listsRoutes(io));
app.use("/api", familyRoutes);
app.use("/api", kidRequestsRoutes(io));

registerListSocketHandlers(io);

server.listen(port, () => {
  console.log(`SmartCart Server running on port : ${port}`);
});
