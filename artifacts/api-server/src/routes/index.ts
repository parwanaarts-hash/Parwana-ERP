import { Router, type IRouter } from "express";
import healthRouter from "./health";
import purchaseGatePassesRouter from "./purchaseGatePasses";
import purchaseBillsRouter from "./purchaseBills";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/purchase-gate-passes", purchaseGatePassesRouter);
router.use("/purchase-bills", purchaseBillsRouter);

export default router;
