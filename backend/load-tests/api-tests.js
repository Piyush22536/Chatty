import http from "k6/http";
import { sleep } from "k6";

export const options = {
  vus: 50,       // 50 virtual users
  duration: "30s"
};

export default function () {
  http.get("http://localhost:3000/api/messages");
  sleep(1);
}  //k6 run load-tests/api-test.js