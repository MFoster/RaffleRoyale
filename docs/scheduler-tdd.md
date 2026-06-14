# **Lightweight EventBridge-Compatible Scheduler (Local Dev Only)**

### **Technical Specification for Implementation**

## **Overview**

Build a standalone microservice named **scheduler** that mimics the core behavior of **AWS EventBridge Scheduler** for local development.  
The service:

* Accepts EventBridge-style schedule creation requests  
* Stores schedules in SQLite  
* Executes one-time schedules at the specified timestamp  
* Sends SQS messages to a preconfigured queue  
* Runs inside Docker alongside API, Jobs, and ElasticMQ

This service is **not** intended for production use.

---

## **1\. Responsibilities**

* **Accept EventBridge-compatible schedule creation requests**  
* **Persist schedules in SQLite**  
* **Run a background worker loop to execute due schedules**  
* **Send SQS messages to a fixed queue URL from environment config**  
* **Support schedule deletion and listing**  
* **Ensure idempotent execution**

---

## **2\. Environment Configuration**

The scheduler must not accept queue URLs from clients.

All SQS routing is controlled via environment variables:

    SCHEDULER_SQS_TARGET_QUEUE_URL=http://elasticmq:9324/queue/raffle-events
    SCHEDULER_DB_PATH=/app/data/scheduler.db
    SCHEDULER_POLL_INTERVAL_MS=1000

---

## **3\. API Specification**

### **3.1 Create Schedule (EventBridge-Compatible)**

**POST /schedules**

**Request Body (EventBridge format):**

| { "Name": "raffle-expire-123", "ScheduleExpression": "at(2026-06-12T04:30:00Z)", "Target": {   "Input": "{\\"type\\":\\"RaffleExpiration\\",\\"raffleId\\":\\"123\\"}" }} |
| :---- |

**Behavior:**

* Parse ScheduleExpression (only at(...) is required for MVP)  
* Parse Target.Input as JSON  
* Store schedule in SQLite  
* Use environment queue URL for delivery

---

### **3.2 Optional Local Format (Supported but not required)**

**POST /schedules**

| { "name": "raffle-expire-123", "runAt": "2026-06-12T04:30:00.000Z", "payload": { "type": "RaffleExpiration", "raffleId": "123" }} |
| :---- |

---

### **3.3 Delete Schedule**

**DELETE /schedules/:name**

Marks schedule as cancelled.

---

### **3.4 List Schedules**

**GET /schedules**

Returns all schedules.

---

### **3.5 Get Schedule**

**GET /schedules/:name**

Returns a single schedule.

---

## **4\. Internal Normalized Schedule Model**

Regardless of input format, store schedules in SQLite using this schema:

### **Table: schedules**

| Column | Type | Notes |
| :---- | :---- | :---- |
| id | TEXT | UUID primary key |
| name | TEXT | Unique |
| runAt | TEXT | ISO timestamp |
| payload | TEXT | JSON string |
| targetQueueUrl | TEXT | From env |
| state | TEXT | scheduled / running / completed / failed / cancelled |
| createdAt | TEXT | ISO timestamp |
| updatedAt | TEXT | ISO timestamp |

### **Indexes**

* UNIQUE(name)  
* INDEX(runAt)

---

## **5\. Background Worker Loop**

Runs every SCHEDULER\_POLL\_INTERVAL\_MS (default 1000ms).

### **Execution Steps**

1. Query schedules where:  
   1. state \= 'scheduled'  
   2. runAt \<= now()  
2. For each schedule:  
   1. Mark state \= 'running'  
   2. Send SQS message:  
      1. Queue URL \= SCHEDULER\_SQS\_TARGET\_QUEUE\_URL  
      2. Body \= payload  
   3. On success → state \= 'completed'  
   4. On failure → state \= 'failed'

### **Tech Stack**

1. Use Nest.js for the overall application.
2. Leverage the use of modules for domain and controller(s) for API endpoints.
3. Adhere to EventBridge Scheduler request bodies, it needs to be identical in shape, we can however "fudge" the values
without validation restrictions.
4. Create the classes for the worker loop using Nest features as much as possible.
5. Write the worker classes so they can be leveraged by a CLI interface as well.
6. Use Nest Commander for implementing a CLI interface to manually create events.

### **Idempotency**

If a schedule is already completed, ignore it.

---

## **6\. SQS Delivery**

Use AWS SDK v3 with local endpoint:

| const sqs \= new SQSClient({ region: "us-east-1", endpoint: "http://elasticmq:9324"}); |
| :---- |

Send message:

| await sqs.send(new SendMessageCommand({ QueueUrl: process.env.SCHEDULER\_SQS\_TARGET\_QUEUE\_URL, MessageBody: JSON.stringify(payload)})); |
| :---- |

---

## **7\. Docker Requirements**

### **Scheduler Container Must:**

* Run HTTP API  
* Run background worker loop  
* Mount SQLite file at /app/data/scheduler.db  
* Depend on ElasticMQ container

### **Volume Example**

| volumes: \- ./scheduler/data:/app/data |
| :---- |

---

## **8\. Acceptance Criteria**

The scheduler is considered complete when:

* **EventBridge-compatible schedule creation works**  
* **Schedules persist in SQLite**  
* **Schedules fire at correct timestamps**  
* **SQS messages are delivered to ElasticMQ**  
* **Schedules can be listed and deleted**  
* **Idempotency prevents double execution**  
* **Service runs cleanly in docker-compose**

---

## **9\. Deliverables**

* **Scheduler service codebase**  
* **Scheduler Dockerfile**  
* **docker-compose.yml integration**  
* **Unit tests**  
* **Integration tests with ElasticMQ**

---