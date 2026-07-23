import { Router, type IRouter } from "express";
import healthRouter from "./health";
import purchaseGatePassesRouter from "./purchaseGatePasses";
import purchaseBillsRouter from "./purchaseBills";
import paymentPaidsRouter from "./paymentPaids";
import saleGatePassesRouter from "./saleGatePasses";
import salesBillsRouter from "./salesBills";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/purchase-gate-passes", purchaseGatePassesRouter);
router.use("/purchase-bills", purchaseBillsRouter);
router.use("/payment-paids", paymentPaidsRouter);
router.use("/sale-gate-passes", saleGatePassesRouter);
router.use("/sales-bills", salesBillsRouter);

export default router;
