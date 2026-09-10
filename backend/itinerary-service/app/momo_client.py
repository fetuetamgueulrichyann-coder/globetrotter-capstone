"""
Client MTN Mobile Money — Collections API (encaissement des frais de
réservation). Documentation officielle : https://momodeveloper.mtn.com

Flux "Request to Pay" :
1. On obtient un jeton d'accès (Basic Auth avec API User + API Key).
2. On envoie une demande de paiement (le client reçoit un push USSD sur son
   téléphone pour confirmer, ou tape son code MoMo).
3. On interroge le statut (PENDING / SUCCESSFUL / FAILED) — le sandbox MTN
   ne notifie pas toujours de callback fiable, on préfère donc l'interroger
   depuis le frontend (polling) plutôt que de dépendre d'un webhook public.

Important : en sandbox, la devise est TOUJOURS "EUR" (imposée par MTN pour
les tests), jamais XAF — le vrai FCFA n'arrive qu'après validation du
compte marchand en production.
"""
import uuid
import requests
from app.config import Config


class MomoNotConfigured(Exception):
    pass


def _require_config():
    if not (Config.MOMO_SUBSCRIPTION_KEY and Config.MOMO_API_USER and Config.MOMO_API_KEY):
        raise MomoNotConfigured("MTN MoMo n'est pas encore configuré (clés manquantes dans .env)")


def get_access_token():
    _require_config()
    resp = requests.post(
        f"{Config.MOMO_BASE_URL}/collection/token/",
        auth=(Config.MOMO_API_USER, Config.MOMO_API_KEY),
        headers={"Ocp-Apim-Subscription-Key": Config.MOMO_SUBSCRIPTION_KEY},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def request_to_pay(amount, phone_msisdn, external_id, payer_message="Frais de réservation MboaTrip"):
    """
    Démarre une demande de paiement. Retourne le reference_id (UUID) à
    conserver pour interroger le statut ensuite — MTN ne renvoie aucun autre
    identifiant dans la réponse (202 Accepted, sans corps).
    """
    _require_config()
    token = get_access_token()
    reference_id = str(uuid.uuid4())

    resp = requests.post(
        f"{Config.MOMO_BASE_URL}/collection/v1_0/requesttopay",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Reference-Id": reference_id,
            "X-Target-Environment": Config.MOMO_TARGET_ENVIRONMENT,
            "Ocp-Apim-Subscription-Key": Config.MOMO_SUBSCRIPTION_KEY,
            "Content-Type": "application/json",
        },
        json={
            "amount": str(amount),
            "currency": Config.MOMO_CURRENCY,
            "externalId": external_id,
            "payer": {"partyIdType": "MSISDN", "partyId": phone_msisdn},
            "payerMessage": payer_message,
            "payeeNote": "MboaTrip - frais de réservation",
        },
        timeout=15,
    )
    resp.raise_for_status()
    return reference_id


def check_payment_status(reference_id):
    """Retourne 'PENDING' | 'SUCCESSFUL' | 'FAILED'."""
    _require_config()
    token = get_access_token()
    resp = requests.get(
        f"{Config.MOMO_BASE_URL}/collection/v1_0/requesttopay/{reference_id}",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Target-Environment": Config.MOMO_TARGET_ENVIRONMENT,
            "Ocp-Apim-Subscription-Key": Config.MOMO_SUBSCRIPTION_KEY,
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json().get("status", "PENDING")
