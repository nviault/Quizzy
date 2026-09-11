# Feuille de Route et Plan d'Architecture - Quizzy Open Source

Ce document présente la feuille de route complète et les jalons d'évolution pour la plateforme **Quizzy Open Source sur Kubernetes**, basée sur la conception définie dans [`architecture_kahoot_open_source_kubernetes.md`](./architecture_kahoot_open_source_kubernetes.md).

---

## 1. Vue d'ensemble de la Feuille de Route

La trajectoire globale est découpée en 10 phases réparties sur des Sprints de 2 semaines, allant du MVP jusqu'à la production haute disponibilité à grande échelle.

| Phase | Description | Sprint cible | Statut |
|---|---|---|---|
| **Phase 1** | Monorepo TypeScript + React + NestJS + Packages partagés | Sprint 1 | **MVP (Actuel)** |
| **Phase 2** | Gestion & Édition des Quizzes et Questions | Sprint 1 | **MVP (Actuel)** |
| **Phase 3** | Gestion des Parties Live, PIN & QR Code | Sprint 1 | **MVP (Actuel)** |
| **Phase 4** | Espace Joueur & Session temporaire | Sprint 1 | **MVP (Actuel)** |
| **Phase 5** | Synchronisation Temps Réel (WebSocket + Redis) | Sprint 2 | **MVP (Actuel)** |
| **Phase 6** | Moteur de Scoring, Machine à états & Résultats | Sprint 2 | **MVP (Actuel)** |
| **Phase 7** | Persistance PostgreSQL & État volatile Redis | Sprint 2 | **MVP (Actuel)** |
| **Phase 8** | Conteneurisation & Helm Charts Kubernetes | Sprint 3 | Évolution future |
| **Phase 9** | Observabilité (OpenTelemetry, Prometheus, Grafana, Loki, Tempo) | Sprint 4 | Évolution future |
| **Phase 10** | Continuous Deployment GitOps (ArgoCD) & Tests de Charge | Sprint 5 | Évolution future |

---

## 2. Planning des Évolutions Futures (Sprints 3 à 5)

### Sprint 3 : Infrastructure Kubernetes & Packaging Helm (Phase 8)
- **Objectif** : Déployer la plateforme sur un cluster Kubernetes avec haute disponibilité et routage avancé.
- **Tâches** :
  - Écriture des Helm Charts (`helm/quizzy`) avec configurations multi-environnements (`dev`, `test`, `prod`).
  - Configuration du Gateway API / Ingress NGINX pour les routes `/`, `/api`, `/ws`.
  - Intégration de CloudNativePG pour PostgreSQL HA et Redis Sentinel/Cluster Opérateur.
  - Mise en place des NetworkPolicies, SecurityContexts et External Secrets avec Vault.
- **Critères d'acceptation** :
  - Déploiement automatisé avec `helm install`.
  - Reconnexion automatique des WebSockets sans perte d'état lors du redémarrage d'un Pod backend.

### Sprint 4 : Observabilité Tout-en-Un (Phase 9)
- **Objectif** : Instrumenter l'application et les pods pour un suivi en temps réel des métriques et des traces.
- **Tâches** :
  - Intégration d'OpenTelemetry SDK dans NestJS (métriques WS, latence event loop, connexions actives).
  - Déploiement de Prometheus pour la collecte des métriques métier (`quizzy_active_games`, `quizzy_answers_total`).
  - Déploiement de Grafana avec dashboards prédéfinis pour le monitoring de charge.
  - Centralisation des logs via Loki et traçage distribué via Tempo.
- **Critères d'acceptation** :
  - Dashboard Grafana fonctionnel affichant les connexions WS simultanées et la latence moyenne de réponse.
  - Alertes configurées sur l'épuisement du pool de connexions Redis/PostgreSQL.

### Sprint 5 : GitOps, CI/CD & Tests de Charge Extrêmes (Phase 10)
- **Objectif** : Automatiser la chaîne de déploiement GitOps et valider le passage à l'échelle pour 1 000+ joueurs.
- **Tâches** :
  - Configuration d'Argo CD avec dépôt de manifeste dédié.
  - Scripts de tests de charge avec k6 / Locust simulant des tirs massifs de réponses en temps réel (100 à 1 000+ joueurs).
  - Configuration du HPA (Horizontal Pod Autoscaler) basé sur des métriques personnalisées Prometheus (connexions WS actives).
- **Critères d'acceptation** :
  - Maintien d'un temps de réponse serveur sous 50ms avec 1 000 joueurs simultanés.
  - Auto-scaling déclenché automatiquement sur dépassement du seuil de connexions par Pod WS.

---

## 3. Périmètre du MVP (Sprint 1 & 2 - Implémentation Immédiate)

Le MVP intègre les éléments fondamentaux suivants :
1. **Monorepo (pnpm workspaces + Turborepo)** : `apps/api` (NestJS), `apps/frontend` (React + Vite + Tailwind), `packages/types`, `packages/events`, `packages/scoring`.
2. **Backend NestJS** :
   - API REST pour les quizzes, questions et authentification/sessions.
   - Gateway WebSocket (Socket.IO) couplée à Redis Pub/Sub.
   - Machine à états stricte (`WAITING`, `QUESTION`, `RESULTS`, `FINISHED`).
   - Moteur de scoring paramétrable avec autorité temporelle côté serveur.
3. **Frontend React/PWA** :
   - Interface Hôte (création quiz, lobby avec PIN/QR Code, pilotage du déroulement, classement).
   - Interface Joueur (saisie PIN + pseudo, réponse instantanée, affichage score/rang).
4. **Environnement Local Docker Compose** :
   - PostgreSQL + Redis + API NestJS + Frontend React.
