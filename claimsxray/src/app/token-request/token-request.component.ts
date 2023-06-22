import { Component, OnInit } from '@angular/core';

import { Utilities } from '../utilities'
import { TokenRequest } from '../models/token-request';
import { TokenParserService } from '../services/token-parser.service';
import { CxraySessionService } from '../services/cxray-session.service';
import { MonitoringService } from '../services/monitoring.service';

@Component({
  selector: 'app-token-request',
  templateUrl: './token-request.component.html'
})
export class TokenRequestComponent implements OnInit {
  protocols = ['SAML', 'WS-Fed', 'Open ID'];
  model: TokenRequest = new TokenRequest();
  replyUrlOidc: string = '';
  replyUrlSaml: string = '';
  submitted = false;

  constructor(
    private tokenParserService: TokenParserService,
    private cxraySessionService: CxraySessionService,
    private monitoringService: MonitoringService
  ){ }

  ngOnInit() {
    this.model = this.tokenParserService.getTokenRequest();
    if (this.model.protocol == '')
      this.model.protocol = 'SAML';
    
    // set reply URLs for the UI
    this.replyUrlOidc = this.tokenParserService.replyHost;
    this.replyUrlSaml = this.tokenParserService.replyHostProxy;
  }

  onSubmit() {
    //enable session
    if (this.model.sessionDuration > 0)
      this.cxraySessionService.enable(this.model.sessionDuration);
    else
      this.cxraySessionService.end();

    // update request cache
    this.tokenParserService.setTokenRequest(this.model);

    // check for existing querystring in the loginUrl
    let querySeparator = this.model.loginUrl.includes('?') ? '&': '?';

    if (this.model.protocol == 'SAML') {
      this.monitoringService.logEvent('LoginRequest', { protocol: 'SAML', loginUrl: this.model.loginUrl, isRefresh: false });
      window.location.href = `${this.model.loginUrl}${querySeparator}SAMLRequest=${Utilities.createSamlRequest(this.model.identifier, this.tokenParserService.replyHostProxy) }`;
    }
    else if (this.model.protocol == 'WS-Fed') {
      this.monitoringService.logEvent('LoginRequest', { protocol: 'WsFed', loginUrl: this.model.loginUrl, isRefresh: false });
      window.location.href = `${this.model.loginUrl}${querySeparator}${Utilities.createWsFedRequest(this.model.identifier, this.tokenParserService.replyHostProxy)}`;
    }
    else {
      this.monitoringService.logEvent('LoginRequest', { protocol: 'OIDC', loginUrl: this.model.loginUrl, isRefresh: false });
      Utilities.createAuthCodeRequest(this.model.identifier, this.model.scope, this.tokenParserService.replyHost).then((request) => {
        // store paremters in token parser service for processing callback
        this.model.codeVerifier = request.verifier;
        // update request cache for PKCE
        this.tokenParserService.setTokenRequest(this.model);
        window.location.href = `${this.model.loginUrl}${querySeparator}${request.data}`;
      });
    }
  }
  createAuthCodeRequest() {
    throw new Error('Method not implemented.');
  }
}
