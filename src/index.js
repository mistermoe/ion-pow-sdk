import * as fetch from 'node-fetch/browser';
import * as hash from  'hash-wasm';


const buffer = require('buffer/').Buffer;
// const fetch = require('node-fetch')
// const hash = require('hash-wasm')

class IonProofOfWork {
    static randomHexString() {
        const size = Math.floor(Math.random() * Math.floor(500));
        const randomString = [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        return buffer.from(randomString).toString('hex');
    }

    static async submitIonRequestUntilSuccess(getChallengeUri, solveChallengeUri, requestBody) {
        let result;
        while (result === undefined) {
            result = await this.submitIonRequest(getChallengeUri, solveChallengeUri, requestBody);
        };
    };

    static async submitIonRequest(getChallengeUri, solveChallengeUri, requestBody) {
        console.log(`Getting challenge from: ${getChallengeUri}`);
        const getChallengeResponse = await fetch(getChallengeUri);
        if (!getChallengeResponse.ok) {
            throw new Error('Get challenge service not available')
        }
        const challengeBody = await getChallengeResponse.json();
        console.log(challengeBody);

        const challengeNonce = challengeBody.challengeNonce;
        const largestAllowedHash = challengeBody.largestAllowedHash;
        const validDuration = challengeBody.validDurationInMinutes * 60 * 1000;
    
        let answerHash = '';
        let answerNonce = '';

        console.log(`Solving for body:\n${requestBody}`);
        const startTime = Date.now();
        do {
            answerNonce = this.randomHexString();
            answerHash = await hash.argon2id({
                password: buffer.from(answerNonce, 'hex').toString() + requestBody,
                salt: buffer.from(challengeNonce, 'hex'),
                parallelism: 1,
                iterations: 1,
                memorySize: 1000,
                hashLength: 32, // output size = 32 bytes
                outputType: 'hex',
            });
            console.log(answerHash);
            console.log(largestAllowedHash);
        } while (answerHash > largestAllowedHash && Date.now() - startTime < validDuration);

        if (Date.now() - startTime >  validDuration) {
            return;
        }

        console.log('3')
        const response = await fetch(solveChallengeUri, {
            method: 'POST',
            body: requestBody,
            headers: {
                'challenge-nonce': challengeNonce,
                'answer-nonce': answerNonce,
                'content-type': 'application/json'
            }
        });

        if (response.status >= 500) {
            console.log(`Unexpected 5xx response: ${await response.text()}`);
        } else if (response.status >= 400) {
            // 400 means bad request, so should retry with a new challenge
            console.log(`Bed request: ${await response.text()}`);
            console.log('Retrying with new challenge and difficulty');
        } else if (response.status >= 300) {
            console.log(`Unexpected 3xx response: ${await response.text()}`);
        } else {
            //success
            console.log(`Successful registration`);
            const responseText = await response.text();
            console.log(responseText);
            return responseText;
        };
    }
}


const body = {
    "type": "create",
    "suffixData": {
      "deltaHash": "EiCLyPswSvuw986FoTQd4jZ-Qv_pg1N07-DtoY0v6NmSfg",
      "recoveryCommitment": "EiB27xMKUNiMuHKtUvVrpXcZP5dGgABqRHNN-HSH4_K9Gw"
    },
    "delta": {
      "updateCommitment": "EiCQ2-uDv1_j5BhcmnM7p96E02CbIJaqT3QFtjCAy8K_Iw",
      "patches": [
        {
          "action": "replace",
          "document": {
            "publicKeys": [
              {
                "id": "integrationTestKey",
                "type": "EcdsaSecp256k1VerificationKey2019",
                "publicKeyJwk": {
                  "kty": "EC",
                  "crv": "secp256k1",
                  "x": "RylkQeOBYJVpRdZ7YSPKHFD4DWIcFCD9NfBPSTX3rio",
                  "y": "nst5yUGomljMpWqzxWP3eKC02RrMfdd3elphTktInUQ"
                },
                "purposes": [
                  "authentication"
                ]
              }
            ],
            "services": [
              {
                "id": "integrationTestService",
                "type": "website",
                "serviceEndpoint": "https://www.some.web.site.com"
              }
            ]
          }
        }
      ]
    }
  }

IonProofOfWork.submitIonRequestUntilSuccess('https://beta.ion.msidentity.com/api/v1.0/proof-of-work-challenge', 'https://beta.ion.msidentity.com/api/v1.0/register', JSON.stringify(body));