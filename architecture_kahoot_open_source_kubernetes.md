# Architecture complète d’un « Kahoot open source »

## Conception d’une plateforme de quiz temps réel déployable sur Kubernetes

> Objectif : proposer une architecture industrialisable pour des classes de 30 à 100 joueurs, avec une trajectoire permettant de monter à plusieurs milliers de joueurs simultanés.

---

## 1. Architecture cible

```text
INTERNET / INTRANET
        │
        ▼
Load Balancer / WAF
        │
        ▼
Kubernetes Gateway API
   ┌────┴───────────────┐
   │                    │
Frontend             Backend
React / PWA          API + WebSocket
                        │
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
      PostgreSQL      Redis          S3/MinIO
      données        état live       médias
      persistantes   Pub/Sub
                        │
                        ▼
                     Worker
                  statistiques

Observabilité :
OpenTelemetry → Prometheus / Loki / Tempo → Grafana
```

---

## 2. Applications

### Host

Interface de l’animateur :

- création et édition des quiz ;
- lancement des parties ;
- affichage du PIN ;
- gestion des questions ;
- affichage des résultats ;
- classement ;
- arrêt/reprise d’une partie.

### Player

Interface smartphone/tablette sous forme de PWA.

Le participant :

1. saisit un PIN ;
2. choisit un pseudo ;
3. rejoint la partie ;
4. répond aux questions ;
5. consulte son score et son classement.

### Admin

Interface d’administration :

- utilisateurs ;
- groupes/classes ;
- droits ;
- quiz ;
- statistiques ;
- supervision des parties ;
- paramètres.

---

## 3. Stack recommandée

| Couche | Technologie |
|---|---|
| Frontend | React + TypeScript |
| UI / PWA | MUI ou Tailwind + Vite / Workbox |
| Backend | NestJS + TypeScript |
| API | REST |
| Temps réel | WebSocket / Socket.IO |
| Base de données | PostgreSQL |
| État live | Redis |
| Messaging | Redis Pub/Sub ; Redis Streams si persistance/rejeu nécessaire |
| Fichiers | S3 / MinIO |
| Authentification | Keycloak / OIDC |
| Routage Kubernetes | Gateway API |
| Packaging | Helm |
| GitOps | Argo CD ou Flux |
| Observabilité | Prometheus + Grafana + Loki + OpenTelemetry |
| CI/CD | GitLab CI |

---

## 4. Backend

Ne pas partir immédiatement sur une multitude de microservices.

Un **modular monolith NestJS**, complété par un composant WebSocket et des workers, offre un meilleur compromis entre simplicité, maintenabilité et évolutivité.

```text
quiz-api
├── auth
├── users
├── quizzes
├── questions
├── games
├── players
├── answers
├── scoring
├── rankings
├── statistics
├── media
└── websocket
```

Lorsque la charge le justifie, certains modules peuvent ensuite devenir des services indépendants :

```text
quiz-api
     │
     ├── game-service
     ├── websocket-service
     ├── statistics-worker
     └── notification-service
```

---

## 5. Modèle de données PostgreSQL

### users

```text
id
username
email
password_hash
role
created_at
```

### quizzes

```text
id
owner_id
title
description
visibility
created_at
updated_at
```

### questions

```text
id
quiz_id
position
type
text
duration_ms
points
media_id
```

### answers

```text
id
question_id
position
text
is_correct
```

### games

La partie live :

```text
id
quiz_id
host_id
pin
status
current_question
started_at
ended_at
```

### players

```text
id
game_id
nickname
session_id
joined_at
last_seen
```

### responses

```text
id
game_id
player_id
question_id
answer_id
received_at
response_time_ms
score
```

Contrainte essentielle :

```sql
UNIQUE(game_id, player_id, question_id)
```

Elle empêche plusieurs réponses pour une même question.

---

## 6. Redis : état temps réel

PostgreSQL conserve les données métier durables.

Redis conserve l’état rapide et temporaire d’une partie :

```text
game:{id}
```

Exemple :

```text
status = QUESTION_RUNNING
question = 7
startedAt = ...
deadline = ...
```

Autres structures :

```text
game:{id}:players
game:{id}:scores
game:{id}:ranking
```

Redis est particulièrement adapté à l’état temps réel et à la diffusion d’événements entre instances.

---

## 7. WebSocket et diffusion

Chaque joueur et l’animateur maintiennent une connexion temps réel.

Plusieurs Pods WebSocket peuvent fonctionner simultanément :

```text
                 Redis
                Pub/Sub
               /   |   \
              /    |    \
           ws-1   ws-2   ws-3
```

Exemple :

```text
Host → WS-2 → Redis PUBLISH → WS-1 / WS-2 / WS-3
                                      │       │       │
                                      ▼       ▼       ▼
                                    Alice    Bob    Émilie
```

Cela évite de dépendre d’un unique serveur WebSocket.

---

## 8. Protocole d’événements

Événements principaux :

```text
PLAYER_JOINED
PLAYER_LEFT
GAME_STARTED
QUESTION_STARTED
ANSWER_SUBMITTED
QUESTION_ENDED
SCORE_UPDATED
LEADERBOARD_UPDATED
GAME_FINISHED
```

Exemple :

```json
{
  "type": "QUESTION_STARTED",
  "gameId": "87452",
  "questionId": "q17",
  "sequence": 42,
  "serverTime": 1789148400000,
  "deadline": 1789148420000
}
```

Le champ `sequence` permet de détecter un événement manquant et de demander une resynchronisation.

---

## 9. Machine à états

La partie doit être gérée par une machine à états explicite :

```text
WAITING
   │ START
   ▼
QUESTION
   │ TIMEOUT
   ▼
RESULTS
   │ NEXT
   └──────────────► QUESTION
                         ...
                         ▼
                       FINISH
```

Les transitions invalides doivent être refusées par le backend.

Par exemple :

```text
WAITING → START       OK
QUESTION → ANSWER    OK
QUESTION → TIMEOUT   OK
RESULTS → NEXT       OK
FINISH → ANSWER      INTERDIT
```

---

## 10. Gestion du temps et des réponses

Le serveur est l’autorité temporelle.

Le client ne doit jamais décider qu’une réponse est encore valide.

```text
question_started_at = T0
deadline = T0 + duration

response_time_ms =
    server_received_at - question_started_at
```

Le timestamp fourni par le smartphone ne doit pas être considéré comme fiable.

Lors de la réception d’une réponse, le backend vérifie :

- la partie existe ;
- le joueur appartient à la partie ;
- la question est la question courante ;
- la deadline n’est pas dépassée ;
- le joueur n’a pas déjà répondu ;
- la réponse existe.

---

## 11. Scoring

Le moteur de scoring doit être isolé afin de permettre plusieurs modes de jeu :

```text
ScoringEngine
├── Classic
├── NoSpeed
├── Team
└── Custom
```

Le calcul peut être paramétrable, par exemple :

```text
score =
    bonne_réponse
      × multiplicateur
      × facteur_rapidité
```

La formule exacte peut être définie selon le mode de jeu.

---

## 12. Sécurité applicative

La bonne réponse ne doit jamais être envoyée au navigateur avant la clôture de la question.

Le client reçoit :

```json
{
  "question": "Quelle est la capitale de l'Australie ?",
  "answers": [
    {"id": 1, "text": "Sydney"},
    {"id": 2, "text": "Canberra"},
    {"id": 3, "text": "Melbourne"},
    {"id": 4, "text": "Perth"}
  ]
}
```

Le serveur conserve :

```text
correctAnswer = 2
```

### Joueurs sans compte

Pour les participants, il est possible d’utiliser :

```text
game PIN
+
nickname
+
temporary player token
```

Le token est limité à une partie et possède une expiration courte.

### Animateurs

Les animateurs utilisent une authentification OIDC :

```text
OIDC
 │
 └── Keycloak
```

ou une fédération d’identité de l’organisation.

---

## 13. Kubernetes

Organisation indicative :

```text
Namespace : kahoot-prod

Deployments
├── frontend       replicas: 2+
├── api            replicas: 3+
├── websocket      replicas: 3+
└── worker         replicas: 2+

Stateful / opérateurs
├── PostgreSQL HA (ex. CloudNativePG)
└── Redis HA / opérateur
```

### Gateway API

```text
quiz.example.fr

/       → frontend
/api/*  → api
/ws/*   → websocket
```

Pour la production, il est préférable de ne pas gérer PostgreSQL HA avec un simple StatefulSet artisanal. Un opérateur comme CloudNativePG ou un PostgreSQL externe apporte une gestion plus robuste de la haute disponibilité.

---

## 14. Autoscaling

Le CPU seul n’est pas un indicateur suffisant pour les WebSockets.

Il faut également mesurer :

```text
active_connections
messages_per_second
connections_per_second
event_loop_latency
```

Exemple :

```text
API
  minReplicas: 3
  maxReplicas: 20

WebSocket
  minReplicas: 3
  maxReplicas: 30
```

---

## 15. Résilience

L’état d’une partie ne doit jamais dépendre de la mémoire d’un Pod.

En cas de crash :

```text
Client
  │ reconnect
  ▼
Load Balancer
  ▼
nouveau WS Pod
  │
  ├── gameId
  ├── playerId
  └── lastSequence
  ▼
resynchronisation
```

Le nouveau Pod récupère l’état depuis Redis/PostgreSQL.

Le jeu peut ainsi continuer malgré la perte d’une instance.

---

## 16. Redis Pub/Sub versus messaging persistant

Il faut distinguer deux catégories d’événements.

### Événements éphémères

```text
PLAYER_JOINED
LEADERBOARD_UPDATED
QUESTION_STARTED
```

Redis Pub/Sub convient bien.

### Événements métier importants

```text
ANSWER_SUBMITTED
GAME_FINISHED
SCORE_CALCULATED
```

Ils peuvent être persistés dans PostgreSQL et, si nécessaire, diffusés via Redis Streams ou un broker persistant.

La raison est que Redis Pub/Sub est éphémère : un consommateur déconnecté ne peut pas récupérer les messages qu’il a manqués.

---

## 17. QR Code

Un QR code affiché par l’animateur peut contenir :

```text
https://quiz.example.fr/play/458921
```

Le participant arrive directement sur la page de la partie.

Expérience :

```text
Animateur
    │
    ▼
QR Code + PIN
    │
    ▼
Smartphone
    │
    ▼
Choix du pseudo
    │
    ▼
Partie
```

C’est particulièrement adapté à une utilisation en classe.

---

## 18. Sécurité Kubernetes

Je mettrais en place :

```text
NetworkPolicy
Pod Security Standards
ServiceAccount dédié
RBAC minimal
Secrets externes
TLS
```

Flux réseau attendu :

```text
frontend
    │
    └── ne peut parler qu’à
         api

api
    ├── PostgreSQL
    ├── Redis
    └── MinIO
```

Le frontend ne doit pas accéder directement à PostgreSQL ou Redis.

### Gestion des secrets

Éviter :

```yaml
env:
  POSTGRES_PASSWORD: "SuperSecret123"
```

dans Git.

Préférer :

```text
External Secrets
        │
        ▼
Vault / Secret Manager
        │
        ▼
Kubernetes Secret
```

---

## 19. Observabilité

Architecture recommandée :

```text
Applications
     │
     ▼
OpenTelemetry Collector
  ┌──────┼────────┐
  ▼      ▼        ▼
Metrics Logs    Traces
  │      │        │
Prometheus Loki  Tempo
       └───┬──────┘
           ▼
        Grafana
```

### Métriques importantes

#### Jeu

```text
kahoot_active_games
kahoot_active_players
kahoot_answers_total
kahoot_games_started_total
kahoot_games_finished_total
```

#### WebSocket

```text
kahoot_ws_connections
kahoot_ws_messages_total
kahoot_ws_disconnects_total
kahoot_ws_latency
```

#### Backend

```text
http_requests_total
http_request_duration
http_5xx_total
```

#### Redis

```text
redis_connected_clients
redis_memory_used
redis_commands_total
```

#### PostgreSQL

```text
connections
transactions
locks
query_latency
```

---

## 20. CI/CD et GitOps

Pipeline :

```text
GitLab
   │
   ├── lint
   ├── tests unitaires
   ├── tests intégration
   ├── scans sécurité
   ├── build image
   └── scan container
          │
          ▼
      Registry
          │
          ▼
   dépôt deployment
          │
          ▼
     Argo CD / Flux
          │
          ▼
      Kubernetes
```

L’intérêt du GitOps est notamment d’éviter que les pipelines CI disposent directement de privilèges d’administration sur le cluster.

---

## 21. Organisation Git

### Repository applicatif

```text
kahoot-app/
├── apps/
│   ├── frontend/
│   ├── api/
│   └── worker/
├── packages/
│   ├── types/
│   ├── events/
│   ├── validation/
│   └── scoring/
└── tests/
```

### Repository déploiement

```text
kahoot-deployment/
├── helm/
│   └── kahoot/
├── environments/
│   ├── dev/
│   ├── test/
│   └── prod/
└── argocd/
```

---

## 22. Helm

Le chart peut exposer des paramètres comme :

```yaml
frontend:
  replicas: 2

api:
  replicas: 3

websocket:
  replicas: 3

worker:
  replicas: 2

postgresql:
  enabled: false

redis:
  enabled: false

autoscaling:
  enabled: true
```

On peut ainsi avoir :

### Petite installation

```text
1 cluster
2 pods applicatifs
Redis
PostgreSQL
```

### Production

```text
3+ API
5+ WebSocket
HA PostgreSQL
HA Redis
```

---

## 23. Dimensionnement indicatif

| Charge | API | WebSocket | Redis | PostgreSQL |
|---|---:|---:|---|---|
| ~100 joueurs | 2 Pods | 2 Pods | 1 instance | 1 instance |
| ~1 000 joueurs | 3 Pods | 3–5 Pods | HA | HA |
| ~10 000 joueurs | scaling | service dédié | HA / cluster | HA + optimisation |

Ces chiffres sont des points de départ et doivent être validés par des tests de charge représentatifs.

---

## 24. Architecture finale recommandée

```text
                         USERS
                           │
                       HTTPS / WSS
                           │
                           ▼
                 Kubernetes Gateway API
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
         Frontend         API        WebSocket
         React/PWA       NestJS        Gateway
                           │             │
                     ┌─────┴─────────────┘
                     ▼
              ┌──────────────┐
              │    Redis     │
              │ état + Pub/Sub
              └──────┬───────┘
                     │
              ┌──────▼───────┐
              │  PostgreSQL  │
              │ données      │
              │ persistantes │
              └──────────────┘

        Observabilité :
        OpenTelemetry → Prometheus/Loki/Tempo → Grafana
```

---

## 25. Choix architectural clé

**Ne pas construire un clone de Kahoot sous forme de 15 microservices dès le départ.**

Le MVP devrait être :

```text
React PWA
     │
     ▼
NestJS
 ┌───┴──────────┐
 │              │
REST          WebSocket
 │              │
 └──────┬───────┘
        │
   ┌────┴─────┐
   │          │
PostgreSQL   Redis
```

Puis Kubernetes apporte :

```text
HA
scaling
rolling update
network policies
observability
GitOps
```

Les microservices spécialisés n’apparaissent que lorsque la charge ou l’organisation les justifie.

---

## 26. Feuille de route MVP

| Phase | Livrable |
|---:|---|
| 1 | Monorepo TypeScript + React + NestJS |
| 2 | Création/édition de quiz |
| 3 | Création de partie + PIN + QR Code |
| 4 | Connexion des joueurs |
| 5 | WebSocket + synchronisation temps réel |
| 6 | Réponses + scoring + classement |
| 7 | PostgreSQL + Redis |
| 8 | Docker + Helm + Kubernetes |
| 9 | Prometheus/Grafana/Loki/OpenTelemetry |
| 10 | Tests de charge à 100 puis 1 000 joueurs |

---

## 27. Architecture MVP que je recommande

Pour une première version réellement exploitable :

```text
┌─────────────────────────────────────────────────────┐
│                   Kubernetes                        │
│                                                     │
│  ┌─────────────┐       ┌────────────────────────┐  │
│  │ React / PWA │───────►│ NestJS API + WebSocket │  │
│  └─────────────┘       └───────────┬────────────┘  │
│                                    │               │
│                          ┌─────────┴─────────┐     │
│                          ▼                   ▼     │
│                     PostgreSQL            Redis   │
│                                                   │
│                    ┌──────────────┐               │
│                    │    Worker    │               │
│                    └──────────────┘               │
└─────────────────────────────────────────────────────┘
```

Cette architecture permet de commencer avec une solution relativement simple tout en conservant une trajectoire vers une plateforme fortement scalable.

---

## 28. Conclusion

Le cœur technique du système est la combinaison :

**React/PWA + NestJS + WebSocket + Redis + PostgreSQL + Kubernetes.**

Les choix essentiels sont :

1. **Le serveur est maître de l’état et du temps.**
2. **Redis gère l’état live et la diffusion entre Pods.**
3. **PostgreSQL conserve les données métier durables.**
4. **Les WebSockets permettent la synchronisation temps réel.**
5. **Les clients peuvent être sans compte grâce à des tokens temporaires.**
6. **Le frontend ne connaît jamais la bonne réponse avant la clôture.**
7. **L’état d’une partie ne dépend jamais de la mémoire d’un Pod.**
8. **Kubernetes fournit le scaling, la résilience et l’exploitation.**
9. **GitOps permet de séparer clairement code applicatif et déploiement.**
10. **L’architecture commence comme un modular monolith et peut évoluer vers des services dédiés.**

> Document de conception : architecture proposée pour un projet open source de quiz temps réel. Elle ne prétend pas reproduire l’architecture interne propriétaire de Kahoot.
