export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      assinaturas: {
        Row: {
          assinado_em: string | null
          assinatura_texto: string | null
          created_at: string
          created_by: string | null
          dados_snapshot: Json | null
          hash_documento: string | null
          id: string
          ip: string | null
          mentorado_id: string | null
          profile_id: string | null
          status: string
          template_id: string
          token: string
          token_expira_em: string | null
          user_agent: string | null
        }
        Insert: {
          assinado_em?: string | null
          assinatura_texto?: string | null
          created_at?: string
          created_by?: string | null
          dados_snapshot?: Json | null
          hash_documento?: string | null
          id?: string
          ip?: string | null
          mentorado_id?: string | null
          profile_id?: string | null
          status?: string
          template_id: string
          token?: string
          token_expira_em?: string | null
          user_agent?: string | null
        }
        Update: {
          assinado_em?: string | null
          assinatura_texto?: string | null
          created_at?: string
          created_by?: string | null
          dados_snapshot?: Json | null
          hash_documento?: string | null
          id?: string
          ip?: string | null
          mentorado_id?: string | null
          profile_id?: string | null
          status?: string
          template_id?: string
          token?: string
          token_expira_em?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "documento_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ciclo_eventos: {
        Row: {
          cronograma_id: string
          data: string | null
          data_fim: string | null
          fase: string | null
          id: string
          instrumentos: string[]
          numero: number | null
          observacao: string | null
          ordem: number
          status: string
          tipo: string
          titulo: string
        }
        Insert: {
          cronograma_id: string
          data?: string | null
          data_fim?: string | null
          fase?: string | null
          id?: string
          instrumentos?: string[]
          numero?: number | null
          observacao?: string | null
          ordem: number
          status?: string
          tipo: string
          titulo: string
        }
        Update: {
          cronograma_id?: string
          data?: string | null
          data_fim?: string | null
          fase?: string | null
          id?: string
          instrumentos?: string[]
          numero?: number | null
          observacao?: string | null
          ordem?: number
          status?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ciclo_eventos_cronograma_id_fkey"
            columns: ["cronograma_id"]
            isOneToOne: false
            referencedRelation: "cronogramas"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicados: {
        Row: {
          audiencia: string
          corpo: string
          created_at: string
          created_by: string | null
          id: string
          prioridade: string
          prioridade_ord: number | null
          titulo: string
        }
        Insert: {
          audiencia?: string
          corpo: string
          created_at?: string
          created_by?: string | null
          id?: string
          prioridade?: string
          prioridade_ord?: number | null
          titulo: string
        }
        Update: {
          audiencia?: string
          corpo?: string
          created_at?: string
          created_by?: string | null
          id?: string
          prioridade?: string
          prioridade_ord?: number | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicados_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicados_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicados_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      cronogramas: {
        Row: {
          created_at: string
          created_by: string | null
          encontros_esperados: number | null
          fim_em: string | null
          id: string
          inicio_em: string | null
          nome: string
          status: string
          trilha: string
          turma: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          encontros_esperados?: number | null
          fim_em?: string | null
          id?: string
          inicio_em?: string | null
          nome: string
          status?: string
          trilha?: string
          turma: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          encontros_esperados?: number | null
          fim_em?: string | null
          id?: string
          inicio_em?: string | null
          nome?: string
          status?: string
          trilha?: string
          turma?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronogramas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronogramas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronogramas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_templates: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          signatario: string
          slug: string
          titulo: string
          versao: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          signatario: string
          slug: string
          titulo: string
          versao?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          signatario?: string
          slug?: string
          titulo?: string
          versao?: number
        }
        Relationships: []
      }
      documentos_pessoa: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mentorado_id: string | null
          nome: string | null
          path: string
          profile_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mentorado_id?: string | null
          nome?: string | null
          path: string
          profile_id?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mentorado_id?: string | null
          nome?: string | null
          path?: string
          profile_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_pessoa_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_pessoa_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_pessoa_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_pessoa_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_pessoa_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_pessoa_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_pessoa_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_pessoa_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      duplas: {
        Row: {
          created_at: string
          cronograma_id: string | null
          demanda: string | null
          devolutiva_pdm: string | null
          encerrada_em: string | null
          id: string
          iniciada_em: string | null
          mentor_id: string
          mentorado_id: string
          motivo_encerramento: string | null
          pdm_url: string | null
          remanejada_de: string | null
          solicitacao_id: string | null
          status: Database["public"]["Enums"]["dupla_status"]
          supervisor_id: string | null
          trilha: string
          turma: string
        }
        Insert: {
          created_at?: string
          cronograma_id?: string | null
          demanda?: string | null
          devolutiva_pdm?: string | null
          encerrada_em?: string | null
          id?: string
          iniciada_em?: string | null
          mentor_id: string
          mentorado_id: string
          motivo_encerramento?: string | null
          pdm_url?: string | null
          remanejada_de?: string | null
          solicitacao_id?: string | null
          status?: Database["public"]["Enums"]["dupla_status"]
          supervisor_id?: string | null
          trilha?: string
          turma: string
        }
        Update: {
          created_at?: string
          cronograma_id?: string | null
          demanda?: string | null
          devolutiva_pdm?: string | null
          encerrada_em?: string | null
          id?: string
          iniciada_em?: string | null
          mentor_id?: string
          mentorado_id?: string
          motivo_encerramento?: string | null
          pdm_url?: string | null
          remanejada_de?: string | null
          solicitacao_id?: string | null
          status?: Database["public"]["Enums"]["dupla_status"]
          supervisor_id?: string | null
          trilha?: string
          turma?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplas_cronograma_id_fkey"
            columns: ["cronograma_id"]
            isOneToOne: false
            referencedRelation: "cronogramas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplas_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplas_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplas_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplas_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplas_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplas_remanejada_de_fkey"
            columns: ["remanejada_de"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplas_solicitacao_fk"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_especialista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplas_solicitacao_fk"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_mural"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplas_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplas_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplas_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      emails_enviados: {
        Row: {
          assunto: string
          audiencia: string[]
          autor_id: string | null
          created_at: string
          destinatarios: number
          enviados: number
          falhas: string[] | null
          id: string
          ref_id: string | null
          tipo: string
        }
        Insert: {
          assunto: string
          audiencia?: string[]
          autor_id?: string | null
          created_at?: string
          destinatarios?: number
          enviados?: number
          falhas?: string[] | null
          id?: string
          ref_id?: string | null
          tipo: string
        }
        Update: {
          assunto?: string
          audiencia?: string[]
          autor_id?: string | null
          created_at?: string
          destinatarios?: number
          enviados?: number
          falhas?: string[] | null
          id?: string
          ref_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_enviados_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_enviados_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_enviados_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      encaminhamentos: {
        Row: {
          created_at: string
          descricao: string
          dupla_id: string
          id: string
          prazo: string | null
          registro_id: string | null
          responsavel: string
          status: Database["public"]["Enums"]["encaminhamento_status"]
        }
        Insert: {
          created_at?: string
          descricao: string
          dupla_id: string
          id?: string
          prazo?: string | null
          registro_id?: string | null
          responsavel?: string
          status?: Database["public"]["Enums"]["encaminhamento_status"]
        }
        Update: {
          created_at?: string
          descricao?: string
          dupla_id?: string
          id?: string
          prazo?: string | null
          registro_id?: string | null
          responsavel?: string
          status?: Database["public"]["Enums"]["encaminhamento_status"]
        }
        Relationships: [
          {
            foreignKeyName: "encaminhamentos_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaminhamentos_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "registros"
            referencedColumns: ["id"]
          },
        ]
      }
      encerramentos: {
        Row: {
          autoavaliacao_mentor: string | null
          checklist: Json
          created_at: string
          decidido_por: string | null
          disponivel_proximo_ciclo: boolean | null
          dupla_id: string
          id: string
          resumo_jornada: string | null
          tipo: string | null
        }
        Insert: {
          autoavaliacao_mentor?: string | null
          checklist?: Json
          created_at?: string
          decidido_por?: string | null
          disponivel_proximo_ciclo?: boolean | null
          dupla_id: string
          id?: string
          resumo_jornada?: string | null
          tipo?: string | null
        }
        Update: {
          autoavaliacao_mentor?: string | null
          checklist?: Json
          created_at?: string
          decidido_por?: string | null
          disponivel_proximo_ciclo?: boolean | null
          dupla_id?: string
          id?: string
          resumo_jornada?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encerramentos_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encerramentos_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encerramentos_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encerramentos_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: true
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
        ]
      }
      encontro_notas: {
        Row: {
          created_at: string
          created_by: string | null
          dupla_id: string
          id: string
          numero: number
          texto: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dupla_id: string
          id?: string
          numero: number
          texto?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dupla_id?: string
          id?: string
          numero?: number
          texto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "encontro_notas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encontro_notas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encontro_notas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encontro_notas_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
        ]
      }
      encontros: {
        Row: {
          created_at: string
          created_by: string | null
          data_hora: string | null
          dupla_id: string
          duracao_min: number
          id: string
          link: string | null
          motivo_reagendamento: string | null
          numero: number
          origem: string
          realizado_em: string | null
          status: Database["public"]["Enums"]["encontro_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_hora?: string | null
          dupla_id: string
          duracao_min?: number
          id?: string
          link?: string | null
          motivo_reagendamento?: string | null
          numero: number
          origem?: string
          realizado_em?: string | null
          status?: Database["public"]["Enums"]["encontro_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_hora?: string | null
          dupla_id?: string
          duracao_min?: number
          id?: string
          link?: string | null
          motivo_reagendamento?: string | null
          numero?: number
          origem?: string
          realizado_em?: string | null
          status?: Database["public"]["Enums"]["encontro_status"]
        }
        Relationships: [
          {
            foreignKeyName: "encontros_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encontros_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encontros_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encontros_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
        ]
      }
      especialista_eventos: {
        Row: {
          foco: string | null
          numero: number
          titulo: string
        }
        Insert: {
          foco?: string | null
          numero: number
          titulo: string
        }
        Update: {
          foco?: string | null
          numero?: number
          titulo?: string
        }
        Relationships: []
      }
      formulario_links: {
        Row: {
          contexto: Json
          created_at: string
          created_by: string | null
          dest_mentorado_id: string | null
          dest_profile_id: string | null
          dupla_id: string | null
          expira_em: string | null
          formulario_id: string
          id: string
          token: string
          usado_em: string | null
        }
        Insert: {
          contexto?: Json
          created_at?: string
          created_by?: string | null
          dest_mentorado_id?: string | null
          dest_profile_id?: string | null
          dupla_id?: string | null
          expira_em?: string | null
          formulario_id: string
          id?: string
          token: string
          usado_em?: string | null
        }
        Update: {
          contexto?: Json
          created_at?: string
          created_by?: string | null
          dest_mentorado_id?: string | null
          dest_profile_id?: string | null
          dupla_id?: string | null
          expira_em?: string | null
          formulario_id?: string
          id?: string
          token?: string
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formulario_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_links_dest_mentorado_id_fkey"
            columns: ["dest_mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_links_dest_mentorado_id_fkey"
            columns: ["dest_mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_links_dest_profile_id_fkey"
            columns: ["dest_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_links_dest_profile_id_fkey"
            columns: ["dest_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_links_dest_profile_id_fkey"
            columns: ["dest_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_links_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_links_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "formularios"
            referencedColumns: ["id"]
          },
        ]
      }
      formulario_respostas: {
        Row: {
          id: string
          link_id: string
          respondido_em: string
          respostas: Json
        }
        Insert: {
          id?: string
          link_id: string
          respondido_em?: string
          respostas: Json
        }
        Update: {
          id?: string
          link_id?: string
          respondido_em?: string
          respostas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "formulario_respostas_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: true
            referencedRelation: "formulario_links"
            referencedColumns: ["id"]
          },
        ]
      }
      formularios: {
        Row: {
          ativo: boolean
          campos: Json
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          sistema: string | null
          titulo: string
          updated_at: string
          versao: number
        }
        Insert: {
          ativo?: boolean
          campos?: Json
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          sistema?: string | null
          titulo: string
          updated_at?: string
          versao?: number
        }
        Update: {
          ativo?: boolean
          campos?: Json
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          sistema?: string | null
          titulo?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "formularios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formularios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formularios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      interacoes: {
        Row: {
          autor_id: string | null
          canal: string
          created_at: string
          dupla_id: string
          id: string
          nota: string | null
          tipo: string
        }
        Insert: {
          autor_id?: string | null
          canal?: string
          created_at?: string
          dupla_id: string
          id?: string
          nota?: string | null
          tipo?: string
        }
        Update: {
          autor_id?: string | null
          canal?: string
          created_at?: string
          dupla_id?: string
          id?: string
          nota?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "interacoes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacoes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacoes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacoes_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
        ]
      }
      login_handoffs: {
        Row: {
          access_token: string
          expires_at: string
          failed: boolean
          nonce: string
          refresh_token: string
        }
        Insert: {
          access_token: string
          expires_at?: string
          failed?: boolean
          nonce: string
          refresh_token: string
        }
        Update: {
          access_token?: string
          expires_at?: string
          failed?: boolean
          nonce?: string
          refresh_token?: string
        }
        Relationships: []
      }
      materiais: {
        Row: {
          audiencia: string
          created_at: string
          descricao: string | null
          encontro_num: number | null
          id: string
          ordem: number
          path: string | null
          tipo: string
          titulo: string
          url: string | null
        }
        Insert: {
          audiencia?: string
          created_at?: string
          descricao?: string | null
          encontro_num?: number | null
          id?: string
          ordem?: number
          path?: string | null
          tipo: string
          titulo: string
          url?: string | null
        }
        Update: {
          audiencia?: string
          created_at?: string
          descricao?: string | null
          encontro_num?: number | null
          id?: string
          ordem?: number
          path?: string | null
          tipo?: string
          titulo?: string
          url?: string | null
        }
        Relationships: []
      }
      mentor_profiles: {
        Row: {
          areas: string[]
          capacidade: number
          disponibilidade: Json | null
          experiencia_previa: string | null
          formacao_externa: string | null
          formacao_ok: boolean
          profile_id: string
          termo_ok: boolean
          tipo: string
        }
        Insert: {
          areas?: string[]
          capacidade?: number
          disponibilidade?: Json | null
          experiencia_previa?: string | null
          formacao_externa?: string | null
          formacao_ok?: boolean
          profile_id: string
          termo_ok?: boolean
          tipo: string
        }
        Update: {
          areas?: string[]
          capacidade?: number
          disponibilidade?: Json | null
          experiencia_previa?: string | null
          formacao_externa?: string | null
          formacao_ok?: boolean
          profile_id?: string
          termo_ok?: boolean
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorados: {
        Row: {
          avatar_path: string | null
          cidade: string | null
          cor_raca: string | null
          created_at: string
          dados_civis: Json | null
          data_nascimento: string | null
          disponibilidade: Json | null
          documento_path: string | null
          email: string | null
          escolaridade: string | null
          form_bruto: Json | null
          genero: string | null
          id: string
          interesses: string[]
          motivacao: string | null
          nome: string
          nome_social: string | null
          notas: string | null
          objetivos: string | null
          ong_origem: string | null
          origem: string | null
          pref_genero_par: string | null
          responsavel: Json | null
          uf: string | null
          whatsapp: string | null
        }
        Insert: {
          avatar_path?: string | null
          cidade?: string | null
          cor_raca?: string | null
          created_at?: string
          dados_civis?: Json | null
          data_nascimento?: string | null
          disponibilidade?: Json | null
          documento_path?: string | null
          email?: string | null
          escolaridade?: string | null
          form_bruto?: Json | null
          genero?: string | null
          id?: string
          interesses?: string[]
          motivacao?: string | null
          nome: string
          nome_social?: string | null
          notas?: string | null
          objetivos?: string | null
          ong_origem?: string | null
          origem?: string | null
          pref_genero_par?: string | null
          responsavel?: Json | null
          uf?: string | null
          whatsapp?: string | null
        }
        Update: {
          avatar_path?: string | null
          cidade?: string | null
          cor_raca?: string | null
          created_at?: string
          dados_civis?: Json | null
          data_nascimento?: string | null
          disponibilidade?: Json | null
          documento_path?: string | null
          email?: string | null
          escolaridade?: string | null
          form_bruto?: Json | null
          genero?: string | null
          id?: string
          interesses?: string[]
          motivacao?: string | null
          nome?: string
          nome_social?: string | null
          notas?: string | null
          objetivos?: string | null
          ong_origem?: string | null
          origem?: string | null
          pref_genero_par?: string | null
          responsavel?: Json | null
          uf?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          comunicado_id: string | null
          corpo: string | null
          created_at: string
          created_by: string | null
          href: string | null
          id: string
          lida_em: string | null
          profile_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          comunicado_id?: string | null
          corpo?: string | null
          created_at?: string
          created_by?: string | null
          href?: string | null
          id?: string
          lida_em?: string | null
          profile_id: string
          tipo: string
          titulo: string
        }
        Update: {
          comunicado_id?: string | null
          corpo?: string | null
          created_at?: string
          created_by?: string | null
          href?: string | null
          id?: string
          lida_em?: string | null
          profile_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_comunicado_id_fkey"
            columns: ["comunicado_id"]
            isOneToOne: false
            referencedRelation: "comunicados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa_notas: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mentorado_id: string | null
          profile_id: string | null
          texto: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mentorado_id?: string | null
          profile_id?: string | null
          texto: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mentorado_id?: string | null
          profile_id?: string | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_notas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_notas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_notas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_notas_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_notas_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_notas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_notas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_notas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      presencas: {
        Row: {
          ciclo_evento_id: string
          id: string
          marcado_em: string
          marcado_por: string | null
          presente: boolean
          profile_id: string
        }
        Insert: {
          ciclo_evento_id: string
          id?: string
          marcado_em?: string
          marcado_por?: string | null
          presente?: boolean
          profile_id: string
        }
        Update: {
          ciclo_evento_id?: string
          id?: string
          marcado_em?: string
          marcado_por?: string | null
          presente?: boolean
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presencas_ciclo_evento_id_fkey"
            columns: ["ciclo_evento_id"]
            isOneToOne: false
            referencedRelation: "ciclo_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_marcado_por_fkey"
            columns: ["marcado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_marcado_por_fkey"
            columns: ["marcado_por"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_marcado_por_fkey"
            columns: ["marcado_por"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          areas: string[] | null
          ativo: boolean
          avatar_path: string | null
          bio: string | null
          cargo: string | null
          cidade: string | null
          consent_lgpd_em: string | null
          cor_raca: string | null
          created_at: string
          dados_civis: Json | null
          data_nascimento: string | null
          documento_path: string | null
          email: string
          empresa: string | null
          form_bruto: Json | null
          genero: string | null
          id: string
          interesses: string[]
          linkedin: string | null
          motivacao: string | null
          nome: string
          nome_social: string | null
          onboarded_em: string | null
          origem: string | null
          pref_genero_par: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          uf: string | null
          user_id: string | null
          voluntariado: string | null
          whatsapp: string | null
        }
        Insert: {
          areas?: string[] | null
          ativo?: boolean
          avatar_path?: string | null
          bio?: string | null
          cargo?: string | null
          cidade?: string | null
          consent_lgpd_em?: string | null
          cor_raca?: string | null
          created_at?: string
          dados_civis?: Json | null
          data_nascimento?: string | null
          documento_path?: string | null
          email: string
          empresa?: string | null
          form_bruto?: Json | null
          genero?: string | null
          id?: string
          interesses?: string[]
          linkedin?: string | null
          motivacao?: string | null
          nome: string
          nome_social?: string | null
          onboarded_em?: string | null
          origem?: string | null
          pref_genero_par?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          uf?: string | null
          user_id?: string | null
          voluntariado?: string | null
          whatsapp?: string | null
        }
        Update: {
          areas?: string[] | null
          ativo?: boolean
          avatar_path?: string | null
          bio?: string | null
          cargo?: string | null
          cidade?: string | null
          consent_lgpd_em?: string | null
          cor_raca?: string | null
          created_at?: string
          dados_civis?: Json | null
          data_nascimento?: string | null
          documento_path?: string | null
          email?: string
          empresa?: string | null
          form_bruto?: Json | null
          genero?: string | null
          id?: string
          interesses?: string[]
          linkedin?: string | null
          motivacao?: string | null
          nome?: string
          nome_social?: string | null
          onboarded_em?: string | null
          origem?: string | null
          pref_genero_par?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          uf?: string | null
          user_id?: string | null
          voluntariado?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      registro_anexos: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mime: string | null
          nome: string
          path: string
          registro_id: string
          tamanho: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mime?: string | null
          nome: string
          path: string
          registro_id: string
          tamanho?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mime?: string | null
          nome?: string
          path?: string
          registro_id?: string
          tamanho?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "registro_anexos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_anexos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_anexos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_anexos_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "registros"
            referencedColumns: ["id"]
          },
        ]
      }
      registros: {
        Row: {
          atividades: string[]
          avaliacao: string | null
          created_at: string
          created_by: string | null
          dificuldade: string | null
          dificuldade_detalhe: string | null
          encontro_id: string
          ferramenta: string | null
          id: string
          observacoes: string | null
          precisa_apoio: boolean
          proximo_passo: string | null
          proximo_passo_detalhe: string | null
          reflexoes: string | null
          tema: string | null
          updated_at: string
        }
        Insert: {
          atividades?: string[]
          avaliacao?: string | null
          created_at?: string
          created_by?: string | null
          dificuldade?: string | null
          dificuldade_detalhe?: string | null
          encontro_id: string
          ferramenta?: string | null
          id?: string
          observacoes?: string | null
          precisa_apoio?: boolean
          proximo_passo?: string | null
          proximo_passo_detalhe?: string | null
          reflexoes?: string | null
          tema?: string | null
          updated_at?: string
        }
        Update: {
          atividades?: string[]
          avaliacao?: string | null
          created_at?: string
          created_by?: string | null
          dificuldade?: string | null
          dificuldade_detalhe?: string | null
          encontro_id?: string
          ferramenta?: string | null
          id?: string
          observacoes?: string | null
          precisa_apoio?: boolean
          proximo_passo?: string | null
          proximo_passo_detalhe?: string | null
          reflexoes?: string | null
          tema?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_encontro_id_fkey"
            columns: ["encontro_id"]
            isOneToOne: true
            referencedRelation: "encontros"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_especialista: {
        Row: {
          created_at: string
          created_by: string | null
          demanda: string
          dupla_dpp_id: string
          dupla_id: string | null
          especialista_desejado_id: string | null
          especialista_id: string | null
          id: string
          mentorado_id: string
          respondida_em: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          demanda: string
          dupla_dpp_id: string
          dupla_id?: string | null
          especialista_desejado_id?: string | null
          especialista_id?: string | null
          id?: string
          mentorado_id: string
          respondida_em?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          demanda?: string
          dupla_dpp_id?: string
          dupla_id?: string | null
          especialista_desejado_id?: string | null
          especialista_id?: string | null
          id?: string
          mentorado_id?: string
          respondida_em?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_especialista_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_dupla_dpp_id_fkey"
            columns: ["dupla_dpp_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_especialista_desejado_id_fkey"
            columns: ["especialista_desejado_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_especialista_desejado_id_fkey"
            columns: ["especialista_desejado_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_especialista_desejado_id_fkey"
            columns: ["especialista_desejado_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_especialista_id_fkey"
            columns: ["especialista_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_especialista_id_fkey"
            columns: ["especialista_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_especialista_id_fkey"
            columns: ["especialista_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisoes: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          dupla_id: string | null
          id: string
          mentor_id: string
          resumo: string
          supervisor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          dupla_id?: string | null
          id?: string
          mentor_id: string
          resumo: string
          supervisor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          dupla_id?: string | null
          id?: string
          mentor_id?: string
          resumo?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisoes_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisoes_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisoes_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisoes_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisoes_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisoes_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisoes_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mentorados_pessoal: {
        Row: {
          cor_raca: string | null
          dados_civis: Json | null
          data_nascimento: string | null
          form_bruto: Json | null
          genero: string | null
          id: string | null
          motivacao: string | null
          nome: string | null
          pref_genero_par: string | null
          responsavel: Json | null
        }
        Insert: {
          cor_raca?: string | null
          dados_civis?: Json | null
          data_nascimento?: string | null
          form_bruto?: Json | null
          genero?: string | null
          id?: string | null
          motivacao?: string | null
          nome?: string | null
          pref_genero_par?: string | null
          responsavel?: Json | null
        }
        Update: {
          cor_raca?: string | null
          dados_civis?: Json | null
          data_nascimento?: string | null
          form_bruto?: Json | null
          genero?: string | null
          id?: string | null
          motivacao?: string | null
          nome?: string | null
          pref_genero_par?: string | null
          responsavel?: Json | null
        }
        Relationships: []
      }
      profiles_contato: {
        Row: {
          documento_path: string | null
          email: string | null
          id: string | null
          whatsapp: string | null
        }
        Insert: {
          documento_path?: never
          email?: string | null
          id?: string | null
          whatsapp?: string | null
        }
        Update: {
          documento_path?: never
          email?: string | null
          id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      profiles_pessoal: {
        Row: {
          cor_raca: string | null
          dados_civis: Json | null
          data_nascimento: string | null
          form_bruto: Json | null
          genero: string | null
          id: string | null
          motivacao: string | null
          nome: string | null
          pref_genero_par: string | null
        }
        Insert: {
          cor_raca?: string | null
          dados_civis?: Json | null
          data_nascimento?: string | null
          form_bruto?: Json | null
          genero?: string | null
          id?: string | null
          motivacao?: string | null
          nome?: string | null
          pref_genero_par?: string | null
        }
        Update: {
          cor_raca?: string | null
          dados_civis?: Json | null
          data_nascimento?: string | null
          form_bruto?: Json | null
          genero?: string | null
          id?: string | null
          motivacao?: string | null
          nome?: string | null
          pref_genero_par?: string | null
        }
        Relationships: []
      }
      solicitacoes_mural: {
        Row: {
          created_at: string | null
          created_by: string | null
          demanda: string | null
          devolutiva_pdm: string | null
          dupla_dpp_id: string | null
          dupla_id: string | null
          especialista_desejado_id: string | null
          especialista_id: string | null
          id: string | null
          mentorado_id: string | null
          mentorado_nome: string | null
          respondida_em: string | null
          status: string | null
          trilha_encerrada_em: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_especialista_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_dupla_dpp_id_fkey"
            columns: ["dupla_dpp_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_especialista_desejado_id_fkey"
            columns: ["especialista_desejado_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_especialista_desejado_id_fkey"
            columns: ["especialista_desejado_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_especialista_desejado_id_fkey"
            columns: ["especialista_desejado_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_especialista_id_fkey"
            columns: ["especialista_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_especialista_id_fkey"
            columns: ["especialista_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_especialista_id_fkey"
            columns: ["especialista_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aceitar_solicitacao: { Args: { p_id: string }; Returns: string }
      areas_perfil_ok: { Args: { areas: string[] }; Returns: boolean }
      assinar_com_token: {
        Args: {
          p_dados: Json
          p_ip: string
          p_texto: string
          p_token: string
          p_ua: string
        }
        Returns: string
      }
      assinar_termo: {
        Args: { p_dados: Json; p_ip: string; p_texto: string; p_ua: string }
        Returns: string
      }
      assinatura_completa_por_token: {
        Args: { p_token: string }
        Returns: Json
      }
      assinatura_por_token: { Args: { p_token: string }; Returns: Json }
      civis_btrim: { Args: { d: Json }; Returns: Json }
      dados_civis_ok: {
        Args: { com_parentesco?: boolean; d: Json }
        Returns: boolean
      }
      definir_pdm_url: {
        Args: { p_dupla: string; p_url: string }
        Returns: undefined
      }
      disponibilidade_ok: { Args: { d: Json }; Returns: boolean }
      email_disponivel: { Args: { p_email: string }; Returns: boolean }
      encerramento_checklist_ok: { Args: { c: Json }; Returns: boolean }
      encerrar_trilha_especialista: {
        Args: {
          p_devolutiva: string
          p_dupla: string
          p_motivo: string
          p_tipo: string
        }
        Returns: undefined
      }
      falhar_login_handoff: { Args: { p_nonce: string }; Returns: undefined }
      formulario_por_token: { Args: { p_token: string }; Returns: Json }
      formularios_limpa_respostas: {
        Args: { p_campos: Json; p_respostas: Json }
        Returns: Json
      }
      interesses_ok: { Args: { interesses: string[] }; Returns: boolean }
      meus_dados_civis: { Args: never; Returns: Json }
      meus_dados_pessoais: { Args: never; Returns: Json }
      my_profile_id: { Args: never; Returns: string }
      my_role: { Args: never; Returns: Database["public"]["Enums"]["app_role"] }
      nome_proprio: { Args: { p: string }; Returns: string }
      pegar_login_handoff: { Args: { p_nonce: string }; Returns: Json }
      regenerar_token_assinatura: { Args: { p_id: string }; Returns: string }
      registrar_login_handoff: {
        Args: { p_access: string; p_nonce: string; p_refresh: string }
        Returns: undefined
      }
      rematch_dupla: {
        Args: {
          p_dupla_id: string
          p_lado: string
          p_motivo?: string
          p_novo_id: string
          p_registrar_nota?: boolean
        }
        Returns: string
      }
      revogar_assinatura: { Args: { p_id: string }; Returns: undefined }
      salvar_autoavaliacao: {
        Args: { p_disponivel: boolean; p_dupla: string; p_texto: string }
        Returns: undefined
      }
      submeter_resposta_formulario: {
        Args: { p_respostas: Json; p_token: string }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "coordenacao"
        | "supervisor"
        | "mentor_dpp"
        | "mentor_especialista"
      dupla_status: "ativa" | "pausada" | "encerrada" | "concluida"
      encaminhamento_status: "pendente" | "feito" | "atrasado"
      encontro_status:
        | "agendado"
        | "realizado"
        | "remarcado"
        | "nao_aconteceu"
        | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "coordenacao",
        "supervisor",
        "mentor_dpp",
        "mentor_especialista",
      ],
      dupla_status: ["ativa", "pausada", "encerrada", "concluida"],
      encaminhamento_status: ["pendente", "feito", "atrasado"],
      encontro_status: [
        "agendado",
        "realizado",
        "remarcado",
        "nao_aconteceu",
        "cancelado",
      ],
    },
  },
} as const
