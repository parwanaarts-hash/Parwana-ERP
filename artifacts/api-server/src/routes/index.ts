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
import reportsRouter from "./reports";
import stockReportsRouter from "./stockReports";
import dashboardRouter from "./dashboard";

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
router.use("/reports", reportsRouter);
router.use("/stock-reports", stockReportsRouter);
router.use("/dashboard", dashboardRouter);

export default router;
