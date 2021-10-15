require("dotenv").config(); // To fetch the environment variables

const AWS = require("aws-sdk");
const cron = require("node-cron");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

function getCloudWatch() {
  AWS.config.update({ region: "us-east-2" });
  const cloudWatch = new AWS.CloudWatch();
  return cloudWatch;
}

function subtractMinsFromDate(date, minutes) {
  const originalDate = new Date(date);
  originalDate.setMinutes(originalDate.getMinutes() - minutes);
  return originalDate;
}

function getDescriptionOfCPUUtilization(
  cloudWatch,
  instanceId,
  startDate,
  endDate,
  period
) {
  return new Promise((resolve, reject) => {
    const params = {
      StartTime: startDate,
      EndTime: endDate,
      MetricName: "CPUUtilization",
      Namespace: "AWS/EC2",
      Period: period,
      Statistics: ["Maximum", "Average"],
      Dimensions: [
        {
          Name: "InstanceId",
          Value: instanceId,
        },
      ],
    };
    cloudWatch.getMetricStatistics(params, function (err, data) {
      if (err) {
        reject(err);
      } else {
        let description = `
        __CPU Utilization__
        Average: ${data.Datapoints[0].Average.toFixed(2)}%
        Maximum: ${data.Datapoints[0].Maximum.toFixed(2)}%`;
        resolve(description);
      }
    });
  });
}

function sendToDiscord(message) {
  const discordBaseUrl = process.env.DISCORD_BASE_URL;
  const discordChatId = process.env.DISCORD_CHAT_ID;
  fetch(discordBaseUrl + discordChatId, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: message,
    }),
  }).catch((error) => {
    console.log(error);
  });
}

async function sendMonitorDetails() {
  const cloudWatch = getCloudWatch();
  const endDate = new Date();
  const startDate = subtractMinsFromDate(endDate, 60);
  const instanceId = process.env.INSTANCE_ID;
  try {
    let finalDescription = `
    **EC2 Monitoring Details**
    Time: ${startDate.toUTCString()} to ${endDate.toUTCString()}`;
    const CPUUtilizationDescription = await getDescriptionOfCPUUtilization(
      cloudWatch,
      instanceId,
      startDate,
      endDate,
      3600
    );
    sendToDiscord(finalDescription + CPUUtilizationDescription);
  } catch {
    sendToDiscord("Sending monitor details failed.");
  }
}

function scheduleMonitorDetailsEveryHour() {
  cron.schedule("0 * * * *", () => {
    sendMonitorDetails();
  });
}

scheduleMonitorDetailsEveryHour();
sendMonitorDetails();
