import { Router, type IRouter } from "express";
import healthRouter from "./health";
import purchaseGatePassesRouter from "./purchaseGatePasses";
import purchaseBillsRouter from "./purchaseBills";
import paymentPaidsRouter from "./paymentPaids";
import saleGatePassesRouter from "./saleGatePasses";
import salesBillsRouter from "./salesBills";
import paymentReceivesRouter from "./paymentReceives";
import returnGatePassesRouter from "./returnGatePasses";
import returnBillsRouter from "./returnBills";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/purchase-gate-passes", purchaseGatePassesRouter);
router.use("/purchase-bills", purchaseBillsRouter);
router.use("/payment-paids", paymentPaidsRouter);
router.use("/sale-gate-passes", saleGatePassesRouter);
router.use("/sales-bills", salesBillsRouter);
router.use("/payment-receives", paymentReceivesRouter);
router.use("/return-gate-passes", returnGatePassesRouter);
router.use("/return-bills", returnBillsRouter);

export default router;
