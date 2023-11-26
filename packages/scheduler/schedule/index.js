const { fileURLToPath } = require("node:url");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");
const { parse, stringify } = require("csv");
const JSZip = require("jszip");
const { DateTime, Duration } = require("luxon");

const WEEK = Duration.fromObject({ days: 7 });

exports.main = async function main({ start, end, file, http }) {
  if (http.method === "OPTIONS") {
    return {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    };
  }

  const startDate = DateTime.fromISO(start);
  const endDate = DateTime.fromISO(end);
  const parser = parse(file, { encoding: "utf8", columns: true });

  const zip = new JSZip();

  for await (const { League, Time, Duration, Location, Address } of parser) {
    if (!League || !Time || !Duration || !Location || !Address) {
      console.log("Skipping invalid row");
      continue;
    }

    const weekday = {
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
      sun: 7,
    }[League.split(" ")[0].toLowerCase()];

    const data = [];
    for (
      let date = startDate.set({ weekday });
      date < endDate;
      date = date.plus(WEEK)
    ) {
      if (date < startDate) continue;
      data.push({
        Type: "GAME",
        "Game Type": "REGULAR",
        Title: League,
        Home: League,
        Away: "",
        Date: date.toFormat("dd/MM/yyyy"),
        Time,
        Duration,
        Location,
        Address,
        Notes: "",
      });
    }

    const output = stringify(data, {
      header: true,
      columns: [
        { key: "Type" },
        { key: "Game Type" },
        { key: "Title" },
        { key: "Home" },
        { key: "Away" },
        { key: "Date" },
        { key: "Time" },
        { key: "Duration" },
        { key: "Location" },
        { key: "Address" },
        { key: "Notes" },
      ],
    });

    zip.file(`${League}.csv`, output);
  }
  return {
    headers: {
      "Content-Type": "application/zip",
      "Access-Control-Allow-Origin": "*",
    },
    body: await zip.generateAsync({ type: "base64" }),
  };
};
