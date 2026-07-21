import CryptoJS from 'crypto-js'

const ENCRYPTION_KEY = process.env.CRM_ENCRYPTION_KEY || 'default-encryption-key-change-in-production'

export function encryptApiKey(apiKey: string): string {
  return CryptoJS.AES.encrypt(apiKey, ENCRYPTION_KEY).toString()
}

export function decryptApiKey(encryptedKey: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedKey, ENCRYPTION_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}

export interface LeadData {
  name: string
  email: string
  phone?: string
  source?: string
  notes?: string
  conversationSummary?: string
  aiRecommendation?: string
  intentScore?: string
}

export interface SyncResult {
  success: boolean
  externalLeadId?: string
  error?: string
}

export interface CRMConfig {
  apiKey?: string
  apiSecret?: string
  domain?: string
  accessToken?: string
  refreshToken?: string
}

abstract class BaseCRMIntegration {
  protected config: CRMConfig

  constructor(encryptedConfig: CRMConfig) {
    this.config = {
      apiKey: encryptedConfig.apiKey ? decryptApiKey(encryptedConfig.apiKey) : undefined,
      apiSecret: encryptedConfig.apiSecret ? decryptApiKey(encryptedConfig.apiSecret) : undefined,
      domain: encryptedConfig.domain,
      accessToken: encryptedConfig.accessToken ? decryptApiKey(encryptedConfig.accessToken) : undefined,
      refreshToken: encryptedConfig.refreshToken ? decryptApiKey(encryptedConfig.refreshToken) : undefined,
    }
  }

  abstract testConnection(): Promise<boolean>
  abstract syncLead(lead: LeadData): Promise<SyncResult>
}

export class HubSpotIntegration extends BaseCRMIntegration {
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      return response.ok
    } catch (error) {
      console.error('HubSpot connection test failed:', error)
      return false
    }
  }

  async syncLead(lead: LeadData): Promise<SyncResult> {
    try {
      const properties: Record<string, string> = {
        firstname: lead.name.split(' ')[0] || lead.name,
        lastname: lead.name.split(' ').slice(1).join(' ') || '',
        email: lead.email,
      }

      if (lead.phone) properties.phone = lead.phone
      if (lead.source) properties.lead_source = lead.source
      if (lead.notes) properties.notes = lead.notes
      if (lead.conversationSummary) properties.hs_content_membership_notes = lead.conversationSummary
      if (lead.intentScore) properties.hs_lead_status = lead.intentScore

      const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
      })

      if (!response.ok) {
        const error = await response.text()
        return { success: false, error }
      }

      const result = await response.json()
      return { success: true, externalLeadId: result.id }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }
}

export class SalesforceIntegration extends BaseCRMIntegration {
  async testConnection(): Promise<boolean> {
    try {
      const domain = this.config.domain || 'login'
      const response = await fetch(`https://${domain}.salesforce.com/services/data/v58.0/sobjects/Lead/describe`, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      return response.ok
    } catch (error) {
      console.error('Salesforce connection test failed:', error)
      return false
    }
  }

  async syncLead(lead: LeadData): Promise<SyncResult> {
    try {
      const domain = this.config.domain || 'login'
      const nameParts = lead.name.split(' ')

      const leadData = {
        FirstName: nameParts[0] || lead.name,
        LastName: nameParts.slice(1).join(' ') || lead.name,
        Email: lead.email,
        Company: 'Unknown',
        ...(lead.phone && { Phone: lead.phone }),
        ...(lead.source && { LeadSource: lead.source }),
        ...(lead.notes && { Description: lead.notes }),
        ...(lead.intentScore && { Status: lead.intentScore === 'hot' ? 'Hot' : lead.intentScore === 'warm' ? 'Warm' : 'Cold' }),
      }

      const response = await fetch(`https://${domain}.salesforce.com/services/data/v58.0/sobjects/Lead`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData),
      })

      if (!response.ok) {
        const error = await response.text()
        return { success: false, error }
      }

      const result = await response.json()
      return { success: true, externalLeadId: result.id }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }
}

export class PipedriveIntegration extends BaseCRMIntegration {
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`https://api.pipedrive.com/v1/users/me?api_token=${this.config.apiKey}`)
      return response.ok
    } catch (error) {
      console.error('Pipedrive connection test failed:', error)
      return false
    }
  }

  async syncLead(lead: LeadData): Promise<SyncResult> {
    try {
      const personData = {
        name: lead.name,
        email: lead.email,
        ...(lead.phone && { phone: lead.phone }),
      }

      const personResponse = await fetch(`https://api.pipedrive.com/v1/persons?api_token=${this.config.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personData),
      })

      if (!personResponse.ok) {
        const error = await personResponse.text()
        return { success: false, error }
      }

      const personResult = await personResponse.json()
      const personId = personResult.data.id

      const leadData: Record<string, any> = {
        title: `Lead: ${lead.name}`,
        person_id: personId,
      }

      if (lead.notes || lead.conversationSummary) {
        leadData.value = lead.notes || lead.conversationSummary
      }

      const leadResponse = await fetch(`https://api.pipedrive.com/v1/leads?api_token=${this.config.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
      })

      if (!leadResponse.ok) {
        const error = await leadResponse.text()
        return { success: false, error }
      }

      const leadResult = await leadResponse.json()
      return { success: true, externalLeadId: leadResult.data.id }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }
}

export class CloseIntegration extends BaseCRMIntegration {
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://api.close.com/api/v1/me/', {
        headers: {
          'Authorization': `Basic ${Buffer.from(this.config.apiKey + ':').toString('base64')}`,
          'Content-Type': 'application/json',
        },
      })
      return response.ok
    } catch (error) {
      console.error('Close connection test failed:', error)
      return false
    }
  }

  async syncLead(lead: LeadData): Promise<SyncResult> {
    try {
      const leadData: Record<string, any> = {
        name: lead.name,
        contacts: [{
          name: lead.name,
          emails: [{ email: lead.email, type: 'office' }],
          ...(lead.phone && { phones: [{ phone: lead.phone, type: 'office' }] }),
        }],
      }

      if (lead.notes || lead.conversationSummary) {
        leadData.description = lead.notes || lead.conversationSummary
      }

      const response = await fetch('https://api.close.com/api/v1/lead/', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(this.config.apiKey + ':').toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData),
      })

      if (!response.ok) {
        const error = await response.text()
        return { success: false, error }
      }

      const result = await response.json()
      return { success: true, externalLeadId: result.id }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }
}

export class ZohoCRMIntegration extends BaseCRMIntegration {
  async testConnection(): Promise<boolean> {
    try {
      const domain = this.config.domain || 'www.zohoapis.com'
      const response = await fetch(`https://${domain}/crm/v2/settings/modules`, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      return response.ok
    } catch (error) {
      console.error('Zoho CRM connection test failed:', error)
      return false
    }
  }

  async syncLead(lead: LeadData): Promise<SyncResult> {
    try {
      const domain = this.config.domain || 'www.zohoapis.com'
      const nameParts = lead.name.split(' ')

      const leadData = {
        data: [{
          First_Name: nameParts[0] || lead.name,
          Last_Name: nameParts.slice(1).join(' ') || lead.name,
          Email: lead.email,
          Company: 'Unknown',
          ...(lead.phone && { Phone: lead.phone }),
          ...(lead.source && { Lead_Source: lead.source }),
          ...(lead.notes && { Description: lead.notes }),
          ...(lead.intentScore && { Lead_Status: lead.intentScore === 'hot' ? 'Hot Lead' : lead.intentScore === 'warm' ? 'Warm Lead' : 'Cold Lead' }),
        }],
      }

      const response = await fetch(`https://${domain}/crm/v2/Leads`, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData),
      })

      if (!response.ok) {
        const error = await response.text()
        return { success: false, error }
      }

      const result = await response.json()
      const leadId = result.data?.[0]?.details?.id
      return { success: true, externalLeadId: leadId }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }
}

export class InstantlyIntegration extends BaseCRMIntegration {
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://api.instantly.ai/api/v1/account', {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
      })
      return response.ok
    } catch (error) {
      console.error('Instantly connection test failed:', error)
      return false
    }
  }

  async syncLead(lead: LeadData): Promise<SyncResult> {
    try {
      const leadData = {
        email: lead.email,
        first_name: lead.name.split(' ')[0] || lead.name,
        last_name: lead.name.split(' ').slice(1).join(' ') || '',
        ...(lead.phone && { phone: lead.phone }),
        ...(lead.source && { company: lead.source }),
        ...(lead.notes && { notes: lead.notes }),
      }

      const response = await fetch('https://api.instantly.ai/api/v1/lead/add', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData),
      })

      if (!response.ok) {
        const error = await response.text()
        return { success: false, error }
      }

      const result = await response.json()
      return { success: true, externalLeadId: result.id || lead.email }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }
}

export function getCRMIntegration(platform: string, config: CRMConfig): BaseCRMIntegration | null {
  switch (platform.toLowerCase()) {
    case 'hubspot':
      return new HubSpotIntegration(config)
    case 'salesforce':
      return new SalesforceIntegration(config)
    case 'pipedrive':
      return new PipedriveIntegration(config)
    case 'close':
      return new CloseIntegration(config)
    case 'zoho':
      return new ZohoCRMIntegration(config)
    case 'instantly':
      return new InstantlyIntegration(config)
    default:
      return null
  }
}
