import express from "express";
import crypto from "crypto";
import { Octokit } from "@octokit/rest";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = "tallalnparis4ev";
const REPO_NAME = "programmer-stories";

const octokit = new Octokit({ auth: GITHUB_TOKEN });

function verifySignature(payload, signature) {
  const sig = Buffer.from(signature || "", "utf8");
  const hmac = crypto.createHmac("sha256", GITHUB_WEBHOOK_SECRET);
  const digest = Buffer.from(
    "sha256=" + hmac.update(payload).digest("hex"),
    "utf8"
  );
  return crypto.timingSafeEqual(sig, digest);
}

app.post("/webhook", async (req, res) => {
  const signature = req.headers["x-hub-signature-256"];

  if (!verifySignature(JSON.stringify(req.body), signature)) {
    return res.status(401).send("Invalid signature");
  }

  const { action, submodule, ref } = req.body;

  // Handle submodule updates
  if (action === "updated" && submodule) {
    try {
      await octokit.repos.createDispatchEvent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        event_type: "cv-submodule-update",
        client_payload: {
          submodule: submodule.name,
          commit: submodule.commit,
        },
      });
      console.log("GitHub Actions workflow triggered successfully");
      res.status(200).send("Webhook processed successfully");
    } catch (error) {
      console.error("Error triggering GitHub Actions workflow:", error);
      res.status(500).send("Error processing webhook");
    }
  }
  // Handle push events
  else if (
    req.headers["x-github-event"] === "push" &&
    ref === "refs/heads/main"
  ) {
    try {
      await octokit.repos.createDispatchEvent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        event_type: "deploy-on-push",
        client_payload: {
          ref: ref,
          commit: req.body.after,
        },
      });
      console.log("Deploy workflow triggered successfully");
      res.status(200).send("Push webhook processed successfully");
    } catch (error) {
      console.error("Error triggering deploy workflow:", error);
      res.status(500).send("Error processing push webhook");
    }
  } else {
    res.status(200).send("Webhook received, but no action taken");
  }
});

app.listen(PORT, () => {
  console.log(`Webhook server is running on port ${PORT}`);
});
