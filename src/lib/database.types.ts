export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "jovem_perfil"
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
            referencedRelation: "mentorados_curriculo"
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
            foreignKeyName: "assinaturas_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_turma"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
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
      avaliacao_links: {
        Row: {
          created_at: string
          dupla_id: string
          encontro_id: string
          expira_em: string
          id: string
          respondido_em: string | null
          respondido_por_profile_id: string | null
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          dupla_id: string
          encontro_id: string
          expira_em: string
          id?: string
          respondido_em?: string | null
          respondido_por_profile_id?: string | null
          status?: string
          token: string
        }
        Update: {
          created_at?: string
          dupla_id?: string
          encontro_id?: string
          expira_em?: string
          id?: string
          respondido_em?: string | null
          respondido_por_profile_id?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacao_links_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_links_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_links_encontro_id_fkey"
            columns: ["encontro_id"]
            isOneToOne: true
            referencedRelation: "encontros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_links_respondido_por_profile_id_fkey"
            columns: ["respondido_por_profile_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_links_respondido_por_profile_id_fkey"
            columns: ["respondido_por_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_links_respondido_por_profile_id_fkey"
            columns: ["respondido_por_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_links_respondido_por_profile_id_fkey"
            columns: ["respondido_por_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_encontro: {
        Row: {
          avaliacao_visivel_mentor: boolean
          avancei: string | null
          comentario: string | null
          created_at: string
          dupla_id: string
          encontro_id: string
          estrelas: number
          id: string
          pedir_apoio: boolean
          respondido_por_profile_id: string | null
          sentimento: string | null
          temas: string[] | null
        }
        Insert: {
          avaliacao_visivel_mentor?: boolean
          avancei?: string | null
          comentario?: string | null
          created_at?: string
          dupla_id: string
          encontro_id: string
          estrelas: number
          id?: string
          pedir_apoio?: boolean
          respondido_por_profile_id?: string | null
          sentimento?: string | null
          temas?: string[] | null
        }
        Update: {
          avaliacao_visivel_mentor?: boolean
          avancei?: string | null
          comentario?: string | null
          created_at?: string
          dupla_id?: string
          encontro_id?: string
          estrelas?: number
          id?: string
          pedir_apoio?: boolean
          respondido_por_profile_id?: string | null
          sentimento?: string | null
          temas?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_encontro_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_encontro_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_encontro_encontro_id_fkey"
            columns: ["encontro_id"]
            isOneToOne: true
            referencedRelation: "encontros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_encontro_respondido_por_profile_id_fkey"
            columns: ["respondido_por_profile_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_encontro_respondido_por_profile_id_fkey"
            columns: ["respondido_por_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_encontro_respondido_por_profile_id_fkey"
            columns: ["respondido_por_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_encontro_respondido_por_profile_id_fkey"
            columns: ["respondido_por_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      chamado_anexos: {
        Row: {
          chamado_id: string
          created_at: string
          created_by: string | null
          id: string
          interno: boolean
          mime: string | null
          nome: string
          path: string
          tamanho: number | null
        }
        Insert: {
          chamado_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          interno?: boolean
          mime?: string | null
          nome: string
          path: string
          tamanho?: number | null
        }
        Update: {
          chamado_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          interno?: boolean
          mime?: string | null
          nome?: string
          path?: string
          tamanho?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chamado_anexos_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_anexos_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados_fila"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_anexos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_anexos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_anexos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_anexos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      chamado_atualizacoes: {
        Row: {
          autor_id: string | null
          chamado_id: string
          created_at: string
          id: string
          texto: string
          tipo: string
        }
        Insert: {
          autor_id?: string | null
          chamado_id: string
          created_at?: string
          id?: string
          texto: string
          tipo?: string
        }
        Update: {
          autor_id?: string | null
          chamado_id?: string
          created_at?: string
          id?: string
          texto?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamado_atualizacoes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_atualizacoes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_atualizacoes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_atualizacoes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_atualizacoes_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_atualizacoes_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados_fila"
            referencedColumns: ["id"]
          },
        ]
      }
      chamado_comentarios: {
        Row: {
          autor_id: string
          chamado_id: string
          created_at: string
          id: string
          texto: string
        }
        Insert: {
          autor_id: string
          chamado_id: string
          created_at?: string
          id?: string
          texto: string
        }
        Update: {
          autor_id?: string
          chamado_id?: string
          created_at?: string
          id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamado_comentarios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_comentarios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_comentarios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_comentarios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_comentarios_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamado_comentarios_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados_fila"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados: {
        Row: {
          assunto: string
          atribuido_a: string | null
          autor_id: string | null
          autor_mentorado_id: string | null
          avaliacao_id: string | null
          categoria: string
          created_at: string
          descricao_outro: string | null
          dupla_id: string | null
          id: string
          mensagem: string | null
          numero: string
          origem: string
          registro_id: string | null
          resolucao_resumo: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assunto: string
          atribuido_a?: string | null
          autor_id?: string | null
          autor_mentorado_id?: string | null
          avaliacao_id?: string | null
          categoria: string
          created_at?: string
          descricao_outro?: string | null
          dupla_id?: string | null
          id?: string
          mensagem?: string | null
          numero?: string
          origem?: string
          registro_id?: string | null
          resolucao_resumo?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assunto?: string
          atribuido_a?: string | null
          autor_id?: string | null
          autor_mentorado_id?: string | null
          avaliacao_id?: string | null
          categoria?: string
          created_at?: string
          descricao_outro?: string | null
          dupla_id?: string | null
          id?: string
          mensagem?: string | null
          numero?: string
          origem?: string
          registro_id?: string | null
          resolucao_resumo?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamados_atribuido_a_fkey"
            columns: ["atribuido_a"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_atribuido_a_fkey"
            columns: ["atribuido_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_atribuido_a_fkey"
            columns: ["atribuido_a"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_atribuido_a_fkey"
            columns: ["atribuido_a"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_autor_mentorado_id_fkey"
            columns: ["autor_mentorado_id"]
            isOneToOne: false
            referencedRelation: "jovem_perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_autor_mentorado_id_fkey"
            columns: ["autor_mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_autor_mentorado_id_fkey"
            columns: ["autor_mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_curriculo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_autor_mentorado_id_fkey"
            columns: ["autor_mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_autor_mentorado_id_fkey"
            columns: ["autor_mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_turma"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes_encontro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "especialista_avaliacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "registros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
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
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
      devolutivas: {
        Row: {
          autor_id: string
          created_at: string
          dupla_id: string
          id: string
          texto: string
        }
        Insert: {
          autor_id: string
          created_at?: string
          dupla_id: string
          id?: string
          texto: string
        }
        Update: {
          autor_id?: string
          created_at?: string
          dupla_id?: string
          id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "devolutivas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolutivas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolutivas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolutivas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolutivas_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolutivas_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
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
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "jovem_perfil"
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
            referencedRelation: "mentorados_curriculo"
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
            foreignKeyName: "documentos_pessoa_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_turma"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_pessoa_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
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
      dupla_saude_snapshots: {
        Row: {
          apoio_jovem: boolean
          avaliacao_jovem_pendente: number
          computado_em: string
          dia: string
          dupla_id: string
          esperado: number
          feitos: number
          fonte: string
          id: string
          motivos: Json
          pediu_apoio: boolean
          registro_pendente: boolean
          semaforo: string
          sinais: Json
        }
        Insert: {
          apoio_jovem?: boolean
          avaliacao_jovem_pendente?: number
          computado_em?: string
          dia: string
          dupla_id: string
          esperado?: number
          feitos?: number
          fonte?: string
          id?: string
          motivos?: Json
          pediu_apoio?: boolean
          registro_pendente?: boolean
          semaforo: string
          sinais?: Json
        }
        Update: {
          apoio_jovem?: boolean
          avaliacao_jovem_pendente?: number
          computado_em?: string
          dia?: string
          dupla_id?: string
          esperado?: number
          feitos?: number
          fonte?: string
          id?: string
          motivos?: Json
          pediu_apoio?: boolean
          registro_pendente?: boolean
          semaforo?: string
          sinais?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dupla_saude_snapshots_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dupla_saude_snapshots_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
            referencedColumns: ["id"]
          },
        ]
      }
      duplas: {
        Row: {
          concluida_em: string | null
          created_at: string
          cronograma_id: string | null
          demanda: string | null
          desfecho: string | null
          desfecho_em: string | null
          desfecho_motivo: string | null
          desfecho_obs: string | null
          desfecho_por: string | null
          devolutiva_pdm: string | null
          encerrada_em: string | null
          id: string
          iniciada_em: string | null
          mentor_id: string
          mentorado_id: string
          motivo_encerramento: string | null
          remanejada_de: string | null
          solicitacao_id: string | null
          status: Database["public"]["Enums"]["dupla_status"]
          supervisor_id: string | null
          trilha: string
          turma: string
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string
          cronograma_id?: string | null
          demanda?: string | null
          desfecho?: string | null
          desfecho_em?: string | null
          desfecho_motivo?: string | null
          desfecho_obs?: string | null
          desfecho_por?: string | null
          devolutiva_pdm?: string | null
          encerrada_em?: string | null
          id?: string
          iniciada_em?: string | null
          mentor_id: string
          mentorado_id: string
          motivo_encerramento?: string | null
          remanejada_de?: string | null
          solicitacao_id?: string | null
          status?: Database["public"]["Enums"]["dupla_status"]
          supervisor_id?: string | null
          trilha?: string
          turma: string
        }
        Update: {
          concluida_em?: string | null
          created_at?: string
          cronograma_id?: string | null
          demanda?: string | null
          desfecho?: string | null
          desfecho_em?: string | null
          desfecho_motivo?: string | null
          desfecho_obs?: string | null
          desfecho_por?: string | null
          devolutiva_pdm?: string | null
          encerrada_em?: string | null
          id?: string
          iniciada_em?: string | null
          mentor_id?: string
          mentorado_id?: string
          motivo_encerramento?: string | null
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
            referencedRelation: "jovem_especialistas"
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
            referencedRelation: "jovem_perfil"
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
            referencedRelation: "mentorados_curriculo"
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
            foreignKeyName: "duplas_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_turma"
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
            foreignKeyName: "duplas_remanejada_de_fkey"
            columns: ["remanejada_de"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
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
            referencedRelation: "jovem_especialistas"
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
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "encaminhamentos_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
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
          checklist: Json
          created_at: string
          decidido_por: string | null
          dupla_id: string
          id: string
          resumo_jornada: string | null
          tipo: string | null
        }
        Insert: {
          checklist?: Json
          created_at?: string
          decidido_por?: string | null
          dupla_id: string
          id?: string
          resumo_jornada?: string | null
          tipo?: string | null
        }
        Update: {
          checklist?: Json
          created_at?: string
          decidido_por?: string | null
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
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "encerramentos_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: true
            referencedRelation: "jovem_duplas"
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
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "encontro_notas_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
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
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "encontros_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
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
      especialista_excecoes: {
        Row: {
          created_at: string
          data: string
          hora_fim: string
          hora_inicio: string
          id: string
          profile_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          data: string
          hora_fim: string
          hora_inicio: string
          id?: string
          profile_id: string
          tipo: string
        }
        Update: {
          created_at?: string
          data?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          profile_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "especialista_excecoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "especialista_excecoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "especialista_excecoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "especialista_excecoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      especialista_grade: {
        Row: {
          created_at: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "especialista_grade_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "especialista_grade_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "especialista_grade_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "especialista_grade_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      formulario_anexos: {
        Row: {
          campo_id: string
          created_at: string
          id: string
          link_id: string
          nome: string
          path: string
          tamanho: number
        }
        Insert: {
          campo_id: string
          created_at?: string
          id?: string
          link_id: string
          nome: string
          path: string
          tamanho: number
        }
        Update: {
          campo_id?: string
          created_at?: string
          id?: string
          link_id?: string
          nome?: string
          path?: string
          tamanho?: number
        }
        Relationships: [
          {
            foreignKeyName: "formulario_anexos_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "formulario_links"
            referencedColumns: ["id"]
          },
        ]
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
          multi_uso: boolean
          origem: string
          respondido_por_profile_id: string | null
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
          multi_uso?: boolean
          origem?: string
          respondido_por_profile_id?: string | null
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
          multi_uso?: boolean
          origem?: string
          respondido_por_profile_id?: string | null
          token?: string
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formulario_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "jovem_perfil"
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
            referencedRelation: "mentorados_curriculo"
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
            foreignKeyName: "formulario_links_dest_mentorado_id_fkey"
            columns: ["dest_mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_turma"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_links_dest_profile_id_fkey"
            columns: ["dest_profile_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
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
            foreignKeyName: "formulario_links_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_links_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "formularios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_links_respondido_por_profile_id_fkey"
            columns: ["respondido_por_profile_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_links_respondido_por_profile_id_fkey"
            columns: ["respondido_por_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_links_respondido_por_profile_id_fkey"
            columns: ["respondido_por_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_links_respondido_por_profile_id_fkey"
            columns: ["respondido_por_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      formulario_respostas: {
        Row: {
          id: string
          link_id: string
          promovido_mentorado_id: string | null
          promovido_profile_id: string | null
          respondido_em: string
          respostas: Json
        }
        Insert: {
          id?: string
          link_id: string
          promovido_mentorado_id?: string | null
          promovido_profile_id?: string | null
          respondido_em?: string
          respostas: Json
        }
        Update: {
          id?: string
          link_id?: string
          promovido_mentorado_id?: string | null
          promovido_profile_id?: string | null
          respondido_em?: string
          respostas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "formulario_respostas_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "formulario_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_respostas_promovido_mentorado_id_fkey"
            columns: ["promovido_mentorado_id"]
            isOneToOne: false
            referencedRelation: "jovem_perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_respostas_promovido_mentorado_id_fkey"
            columns: ["promovido_mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_respostas_promovido_mentorado_id_fkey"
            columns: ["promovido_mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_curriculo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_respostas_promovido_mentorado_id_fkey"
            columns: ["promovido_mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_respostas_promovido_mentorado_id_fkey"
            columns: ["promovido_mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_turma"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_respostas_promovido_profile_id_fkey"
            columns: ["promovido_profile_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_respostas_promovido_profile_id_fkey"
            columns: ["promovido_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_respostas_promovido_profile_id_fkey"
            columns: ["promovido_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_respostas_promovido_profile_id_fkey"
            columns: ["promovido_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
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
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
      ia_chunks: {
        Row: {
          created_at: string
          guia: string
          id: string
          pagina: number | null
          secao: string | null
          texto: string
          tsv: unknown
        }
        Insert: {
          created_at?: string
          guia: string
          id?: string
          pagina?: number | null
          secao?: string | null
          texto: string
          tsv?: unknown
        }
        Update: {
          created_at?: string
          guia?: string
          id?: string
          pagina?: number | null
          secao?: string | null
          texto?: string
          tsv?: unknown
        }
        Relationships: []
      }
      ia_eventos: {
        Row: {
          args: Json
          canal: string
          created_at: string
          duracao_ms: number | null
          erro: string | null
          id: string
          ok: boolean
          profile_id: string
          tool: string
        }
        Insert: {
          args?: Json
          canal: string
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          id?: string
          ok: boolean
          profile_id: string
          tool: string
        }
        Update: {
          args?: Json
          canal?: string
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          id?: string
          ok?: boolean
          profile_id?: string
          tool?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_eventos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_eventos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_eventos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_eventos_profile_id_fkey"
            columns: ["profile_id"]
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
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "interacoes_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
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
          audiencias: string[]
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
          audiencias?: string[]
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
          audiencias?: string[]
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
          capacidade_especialista: number
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
          capacidade_especialista?: number
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
          capacidade_especialista?: number
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
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
          contato_compartilhado: boolean
          cor_raca: string | null
          created_at: string
          curriculo_path: string | null
          curriculo_url: string | null
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
          motivo_saida: string | null
          nome: string
          nome_social: string | null
          notas: string | null
          objetivos: string | null
          ong_origem: string | null
          origem: string | null
          pref_genero_par: string | null
          profile_id: string | null
          responsavel: Json | null
          saiu_em: string | null
          situacao: string
          uf: string | null
          whatsapp: string | null
        }
        Insert: {
          avatar_path?: string | null
          cidade?: string | null
          contato_compartilhado?: boolean
          cor_raca?: string | null
          created_at?: string
          curriculo_path?: string | null
          curriculo_url?: string | null
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
          motivo_saida?: string | null
          nome: string
          nome_social?: string | null
          notas?: string | null
          objetivos?: string | null
          ong_origem?: string | null
          origem?: string | null
          pref_genero_par?: string | null
          profile_id?: string | null
          responsavel?: Json | null
          saiu_em?: string | null
          situacao?: string
          uf?: string | null
          whatsapp?: string | null
        }
        Update: {
          avatar_path?: string | null
          cidade?: string | null
          contato_compartilhado?: boolean
          cor_raca?: string | null
          created_at?: string
          curriculo_path?: string | null
          curriculo_url?: string | null
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
          motivo_saida?: string | null
          nome?: string
          nome_social?: string | null
          notas?: string | null
          objetivos?: string | null
          ong_origem?: string | null
          origem?: string | null
          pref_genero_par?: string | null
          profile_id?: string | null
          responsavel?: Json | null
          saiu_em?: string | null
          situacao?: string
          uf?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentorados_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorados_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorados_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorados_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "jovem_especialistas"
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
            referencedRelation: "jovem_especialistas"
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
      pdm: {
        Row: {
          created_at: string
          dupla_id: string
          id: string
          updated_at: string
          visao: string | null
          visao_em: string | null
        }
        Insert: {
          created_at?: string
          dupla_id: string
          id?: string
          updated_at?: string
          visao?: string | null
          visao_em?: string | null
        }
        Update: {
          created_at?: string
          dupla_id?: string
          id?: string
          updated_at?: string
          visao?: string | null
          visao_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdm_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: true
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdm_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: true
            referencedRelation: "jovem_duplas"
            referencedColumns: ["id"]
          },
        ]
      }
      pdm_itens: {
        Row: {
          area_vida: string | null
          atingida_em: string | null
          created_at: string
          created_by: string | null
          id: string
          indicador: string | null
          ordem: number
          origem: string
          origem_campo: string | null
          parent_id: string | null
          pdm_id: string
          porque: string | null
          prazo_alvo: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          area_vida?: string | null
          atingida_em?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          indicador?: string | null
          ordem?: number
          origem?: string
          origem_campo?: string | null
          parent_id?: string | null
          pdm_id: string
          porque?: string | null
          prazo_alvo?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          area_vida?: string | null
          atingida_em?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          indicador?: string | null
          ordem?: number
          origem?: string
          origem_campo?: string | null
          parent_id?: string | null
          pdm_id?: string
          porque?: string | null
          prazo_alvo?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdm_itens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdm_itens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdm_itens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdm_itens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdm_itens_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pdm_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdm_itens_pdm_id_fkey"
            columns: ["pdm_id"]
            isOneToOne: false
            referencedRelation: "pdm"
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
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "jovem_perfil"
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
            referencedRelation: "mentorados_curriculo"
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
            foreignKeyName: "pessoa_notas_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_turma"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_notas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
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
            referencedRelation: "jovem_especialistas"
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
            referencedRelation: "jovem_especialistas"
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
      profile_papeis: {
        Row: {
          created_at: string
          escopo_supervisao: string
          escopo_turma: string | null
          id: string
          papel: Database["public"]["Enums"]["app_role"]
          primario: boolean
          profile_id: string
        }
        Insert: {
          created_at?: string
          escopo_supervisao?: string
          escopo_turma?: string | null
          id?: string
          papel: Database["public"]["Enums"]["app_role"]
          primario?: boolean
          profile_id: string
        }
        Update: {
          created_at?: string
          escopo_supervisao?: string
          escopo_turma?: string | null
          id?: string
          papel?: Database["public"]["Enums"]["app_role"]
          primario?: boolean
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_papeis_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_papeis_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_papeis_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_papeis_profile_id_fkey"
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
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
      registro_lembretes: {
        Row: {
          encontro_id: string
          enviado_em: string
          id: string
          marco: string
          notificacao_id: string | null
        }
        Insert: {
          encontro_id: string
          enviado_em?: string
          id?: string
          marco: string
          notificacao_id?: string | null
        }
        Update: {
          encontro_id?: string
          enviado_em?: string
          id?: string
          marco?: string
          notificacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registro_lembretes_encontro_id_fkey"
            columns: ["encontro_id"]
            isOneToOne: false
            referencedRelation: "encontros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_lembretes_notificacao_id_fkey"
            columns: ["notificacao_id"]
            isOneToOne: false
            referencedRelation: "notificacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      registro_tentativas: {
        Row: {
          concluido: boolean
          created_at: string
          dispositivo: string | null
          dupla_id: string
          duracao_ms: number | null
          encontro_id: string | null
          etapas: Json | null
          id: string
          inicio: string
          origem: string
          profile_id: string | null
          registro_id: string | null
          ultima_atividade: string | null
        }
        Insert: {
          concluido?: boolean
          created_at?: string
          dispositivo?: string | null
          dupla_id: string
          duracao_ms?: number | null
          encontro_id?: string | null
          etapas?: Json | null
          id?: string
          inicio?: string
          origem: string
          profile_id?: string | null
          registro_id?: string | null
          ultima_atividade?: string | null
        }
        Update: {
          concluido?: boolean
          created_at?: string
          dispositivo?: string | null
          dupla_id?: string
          duracao_ms?: number | null
          encontro_id?: string | null
          etapas?: Json | null
          id?: string
          inicio?: string
          origem?: string
          profile_id?: string | null
          registro_id?: string | null
          ultima_atividade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registro_tentativas_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_tentativas_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_tentativas_encontro_id_fkey"
            columns: ["encontro_id"]
            isOneToOne: false
            referencedRelation: "encontros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_tentativas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_tentativas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_tentativas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_tentativas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_tentativas_registro_id_fkey"
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
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
      relatorio_links: {
        Row: {
          config: Json
          created_at: string
          criado_por: string | null
          expira_em: string | null
          id: string
          revogado_em: string | null
          revogado_por: string | null
          senha_hash: string | null
          slug: string
          titulo: string
          turma: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          criado_por?: string | null
          expira_em?: string | null
          id?: string
          revogado_em?: string | null
          revogado_por?: string | null
          senha_hash?: string | null
          slug?: string
          titulo: string
          turma?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          criado_por?: string | null
          expira_em?: string | null
          id?: string
          revogado_em?: string | null
          revogado_por?: string | null
          senha_hash?: string | null
          slug?: string
          titulo?: string
          turma?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_links_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_links_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_links_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_links_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_links_revogado_por_fkey"
            columns: ["revogado_por"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_links_revogado_por_fkey"
            columns: ["revogado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_links_revogado_por_fkey"
            columns: ["revogado_por"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_links_revogado_por_fkey"
            columns: ["revogado_por"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      resumo_acessos: {
        Row: {
          acessado_em: string
          id: string
          ip_hash: string | null
          link_id: string | null
          motivo: string | null
          ok: boolean
          params: Json
          slug: string
          user_agent: string | null
        }
        Insert: {
          acessado_em?: string
          id?: string
          ip_hash?: string | null
          link_id?: string | null
          motivo?: string | null
          ok?: boolean
          params?: Json
          slug: string
          user_agent?: string | null
        }
        Update: {
          acessado_em?: string
          id?: string
          ip_hash?: string | null
          link_id?: string | null
          motivo?: string | null
          ok?: boolean
          params?: Json
          slug?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resumo_acessos_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "relatorio_links"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacao_propostas: {
        Row: {
          autor_id: string
          created_at: string
          id: string
          mensagem: string | null
          slot_proposto: string
          solicitacao_id: string
        }
        Insert: {
          autor_id: string
          created_at?: string
          id?: string
          mensagem?: string | null
          slot_proposto: string
          solicitacao_id: string
        }
        Update: {
          autor_id?: string
          created_at?: string
          id?: string
          mensagem?: string | null
          slot_proposto?: string
          solicitacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacao_propostas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacao_propostas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacao_propostas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacao_propostas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacao_propostas_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_especialista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacao_propostas_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_mural"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_especialista: {
        Row: {
          created_at: string
          created_by: string | null
          demanda: string | null
          dupla_dpp_id: string | null
          dupla_id: string | null
          especialista_desejado_id: string | null
          especialista_id: string | null
          id: string
          justificativa_recusa: string | null
          mentorado_id: string
          motivo: string | null
          origem: string
          respondida_em: string | null
          slot_proposto: string | null
          status: string
          turma: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          demanda?: string | null
          dupla_dpp_id?: string | null
          dupla_id?: string | null
          especialista_desejado_id?: string | null
          especialista_id?: string | null
          id?: string
          justificativa_recusa?: string | null
          mentorado_id: string
          motivo?: string | null
          origem?: string
          respondida_em?: string | null
          slot_proposto?: string | null
          status?: string
          turma?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          demanda?: string | null
          dupla_dpp_id?: string | null
          dupla_id?: string | null
          especialista_desejado_id?: string | null
          especialista_id?: string | null
          id?: string
          justificativa_recusa?: string | null
          mentorado_id?: string
          motivo?: string | null
          origem?: string
          respondida_em?: string | null
          slot_proposto?: string | null
          status?: string
          turma?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_especialista_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "solicitacoes_especialista_dupla_dpp_id_fkey"
            columns: ["dupla_dpp_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
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
            foreignKeyName: "solicitacoes_especialista_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_especialista_desejado_id_fkey"
            columns: ["especialista_desejado_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
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
            referencedRelation: "jovem_especialistas"
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
            referencedRelation: "jovem_perfil"
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
            referencedRelation: "mentorados_curriculo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_turma"
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
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "supervisoes_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisoes_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
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
            referencedRelation: "jovem_especialistas"
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
      terceiros_consolidacao: {
        Row: {
          consolidado: string | null
          dupla_id: string
          escrito_por: string | null
          publicado_em: string | null
          updated_at: string
        }
        Insert: {
          consolidado?: string | null
          dupla_id: string
          escrito_por?: string | null
          publicado_em?: string | null
          updated_at?: string
        }
        Update: {
          consolidado?: string | null
          dupla_id?: string
          escrito_por?: string | null
          publicado_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terceiros_consolidacao_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: true
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiros_consolidacao_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: true
            referencedRelation: "jovem_duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiros_consolidacao_escrito_por_fkey"
            columns: ["escrito_por"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiros_consolidacao_escrito_por_fkey"
            columns: ["escrito_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiros_consolidacao_escrito_por_fkey"
            columns: ["escrito_por"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiros_consolidacao_escrito_por_fkey"
            columns: ["escrito_por"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
      terceiros_contatos: {
        Row: {
          created_at: string
          created_by: string | null
          dupla_id: string
          expira_em: string
          id: string
          nome: string
          respondido_em: string | null
          status: string
          token: string
          vinculo: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dupla_id: string
          expira_em?: string
          id?: string
          nome: string
          respondido_em?: string | null
          status?: string
          token?: string
          vinculo: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dupla_id?: string
          expira_em?: string
          id?: string
          nome?: string
          respondido_em?: string | null
          status?: string
          token?: string
          vinculo?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terceiros_contatos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiros_contatos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiros_contatos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiros_contatos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiros_contatos_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiros_contatos_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
            referencedColumns: ["id"]
          },
        ]
      }
      terceiros_respostas: {
        Row: {
          a_melhorar: string
          contato_id: string
          id: string
          pontos_fortes: string
          respondido_em: string
        }
        Insert: {
          a_melhorar: string
          contato_id: string
          id?: string
          pontos_fortes: string
          respondido_em?: string
        }
        Update: {
          a_melhorar?: string
          contato_id?: string
          id?: string
          pontos_fortes?: string
          respondido_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "terceiros_respostas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: true
            referencedRelation: "terceiros_contatos"
            referencedColumns: ["id"]
          },
        ]
      }
      trilha_lembretes: {
        Row: {
          destino: string
          dupla_id: string
          enviado_em: string
          id: string
          marco: string
          notificacao_id: string | null
        }
        Insert: {
          destino: string
          dupla_id: string
          enviado_em?: string
          id?: string
          marco: string
          notificacao_id?: string | null
        }
        Update: {
          destino?: string
          dupla_id?: string
          enviado_em?: string
          id?: string
          marco?: string
          notificacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trilha_lembretes_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilha_lembretes_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilha_lembretes_notificacao_id_fkey"
            columns: ["notificacao_id"]
            isOneToOne: false
            referencedRelation: "notificacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      turma_inscricoes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mentorado_id: string | null
          nota: string | null
          papel_esperado: string
          profile_id: string | null
          status: string
          turma: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mentorado_id?: string | null
          nota?: string | null
          papel_esperado: string
          profile_id?: string | null
          status?: string
          turma: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mentorado_id?: string | null
          nota?: string | null
          papel_esperado?: string
          profile_id?: string | null
          status?: string
          turma?: string
        }
        Relationships: [
          {
            foreignKeyName: "turma_inscricoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_inscricoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_inscricoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_inscricoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_inscricoes_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "jovem_perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_inscricoes_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_inscricoes_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_curriculo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_inscricoes_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_inscricoes_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_turma"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_inscricoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_inscricoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_inscricoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_contato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_inscricoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_pessoal"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      chamados_fila: {
        Row: {
          assunto: string | null
          atribuido_a: string | null
          autor_id: string | null
          autor_mentorado_id: string | null
          avaliacao_id: string | null
          categoria: string | null
          created_at: string | null
          descricao_outro: string | null
          dupla_id: string | null
          id: string | null
          mensagem: string | null
          numero: string | null
          origem: string | null
          registro_id: string | null
          resolucao_resumo: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assunto?: never
          atribuido_a?: never
          autor_id?: never
          autor_mentorado_id?: never
          avaliacao_id?: never
          categoria?: string | null
          created_at?: string | null
          descricao_outro?: never
          dupla_id?: never
          id?: string | null
          mensagem?: never
          numero?: string | null
          origem?: string | null
          registro_id?: never
          resolucao_resumo?: never
          resolvido_em?: string | null
          resolvido_por?: never
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assunto?: never
          atribuido_a?: never
          autor_id?: never
          autor_mentorado_id?: never
          avaliacao_id?: never
          categoria?: string | null
          created_at?: string | null
          descricao_outro?: never
          dupla_id?: never
          id?: string | null
          mensagem?: never
          numero?: string | null
          origem?: string | null
          registro_id?: never
          resolucao_resumo?: never
          resolvido_em?: string | null
          resolvido_por?: never
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      especialista_avaliacoes: {
        Row: {
          created_at: string | null
          dupla_id: string | null
          encontro_id: string | null
          estrelas: number | null
          id: string | null
          numero: number | null
          realizado_em: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_encontro_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_encontro_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_encontro_encontro_id_fkey"
            columns: ["encontro_id"]
            isOneToOne: true
            referencedRelation: "encontros"
            referencedColumns: ["id"]
          },
        ]
      }
      jovem_assinaturas: {
        Row: {
          assinado_em: string | null
          created_at: string | null
          id: string | null
          slug: string | null
          status: string | null
          template_id: string | null
          titulo: string | null
          token: string | null
          token_expira_em: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "documento_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      jovem_contatos: {
        Row: {
          avatar_path: string | null
          dupla_id: string | null
          email: string | null
          id: string | null
          nome: string | null
          nome_social: string | null
          papel: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          whatsapp: string | null
        }
        Relationships: []
      }
      jovem_duplas: {
        Row: {
          cronograma_id: string | null
          demanda: string | null
          encerrada_em: string | null
          id: string | null
          iniciada_em: string | null
          mentor_avatar_path: string | null
          mentor_id: string | null
          mentor_nome: string | null
          mentor_nome_social: string | null
          motivo_encerramento: string | null
          status: Database["public"]["Enums"]["dupla_status"] | null
          supervisor_avatar_path: string | null
          supervisor_id: string | null
          supervisor_nome: string | null
          supervisor_nome_social: string | null
          trilha: string | null
          turma: string | null
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
            referencedRelation: "jovem_especialistas"
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
            foreignKeyName: "duplas_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
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
      jovem_encaminhamentos: {
        Row: {
          created_at: string | null
          descricao: string | null
          dupla_id: string | null
          id: string | null
          prazo: string | null
          status: Database["public"]["Enums"]["encaminhamento_status"] | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          dupla_id?: string | null
          id?: string | null
          prazo?: string | null
          status?: Database["public"]["Enums"]["encaminhamento_status"] | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          dupla_id?: string | null
          id?: string | null
          prazo?: string | null
          status?: Database["public"]["Enums"]["encaminhamento_status"] | null
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
            foreignKeyName: "encaminhamentos_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
            referencedColumns: ["id"]
          },
        ]
      }
      jovem_especialistas: {
        Row: {
          areas: string[] | null
          avatar_path: string | null
          bio: string | null
          cargo: string | null
          cidade: string | null
          empresa: string | null
          experiencia_previa: string | null
          formacao_externa: string | null
          grade_resumo: string[] | null
          id: string | null
          nome: string | null
          nome_social: string | null
          uf: string | null
          vagas: number | null
          voluntariado: string | null
        }
        Relationships: []
      }
      jovem_perfil: {
        Row: {
          avatar_path: string | null
          cidade: string | null
          contato_compartilhado: boolean | null
          cor_raca: string | null
          created_at: string | null
          dados_civis: Json | null
          data_nascimento: string | null
          disponibilidade: Json | null
          email: string | null
          escolaridade: string | null
          genero: string | null
          id: string | null
          interesses: string[] | null
          motivacao: string | null
          nome: string | null
          nome_social: string | null
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
          contato_compartilhado?: boolean | null
          cor_raca?: string | null
          created_at?: string | null
          dados_civis?: Json | null
          data_nascimento?: string | null
          disponibilidade?: Json | null
          email?: string | null
          escolaridade?: string | null
          genero?: string | null
          id?: string | null
          interesses?: string[] | null
          motivacao?: string | null
          nome?: string | null
          nome_social?: string | null
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
          contato_compartilhado?: boolean | null
          cor_raca?: string | null
          created_at?: string | null
          dados_civis?: Json | null
          data_nascimento?: string | null
          disponibilidade?: Json | null
          email?: string | null
          escolaridade?: string | null
          genero?: string | null
          id?: string | null
          interesses?: string[] | null
          motivacao?: string | null
          nome?: string | null
          nome_social?: string | null
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
      jovem_trilha_esp: {
        Row: {
          foco: string | null
          numero: number | null
          titulo: string | null
        }
        Insert: {
          foco?: string | null
          numero?: number | null
          titulo?: string | null
        }
        Update: {
          foco?: string | null
          numero?: number | null
          titulo?: string | null
        }
        Relationships: []
      }
      mentorados_curriculo: {
        Row: {
          curriculo_path: string | null
          curriculo_url: string | null
          id: string | null
          nome: string | null
        }
        Insert: {
          curriculo_path?: string | null
          curriculo_url?: string | null
          id?: string | null
          nome?: string | null
        }
        Update: {
          curriculo_path?: string | null
          curriculo_url?: string | null
          id?: string | null
          nome?: string | null
        }
        Relationships: []
      }
      mentorados_pessoal: {
        Row: {
          contato_compartilhado: boolean | null
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
          contato_compartilhado?: boolean | null
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
          contato_compartilhado?: boolean | null
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
      mentorados_turma: {
        Row: {
          avatar_path: string | null
          cidade: string | null
          id: string | null
          interesses: string[] | null
          nome: string | null
          nome_social: string | null
          uf: string | null
          whatsapp: string | null
        }
        Insert: {
          avatar_path?: string | null
          cidade?: string | null
          id?: string | null
          interesses?: string[] | null
          nome?: string | null
          nome_social?: string | null
          uf?: string | null
          whatsapp?: never
        }
        Update: {
          avatar_path?: string | null
          cidade?: string | null
          id?: string | null
          interesses?: string[] | null
          nome?: string | null
          nome_social?: string | null
          uf?: string | null
          whatsapp?: never
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
          especialista_nome: string | null
          id: string | null
          justificativa_recusa: string | null
          mentorado_id: string | null
          mentorado_nome: string | null
          motivo: string | null
          origem: string | null
          respondida_em: string | null
          slot_proposto: string | null
          status: string | null
          status_efetivo: string | null
          trilha_encerrada_em: string | null
          turma: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_especialista_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "solicitacoes_especialista_dupla_dpp_id_fkey"
            columns: ["dupla_dpp_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
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
            foreignKeyName: "solicitacoes_especialista_dupla_id_fkey"
            columns: ["dupla_id"]
            isOneToOne: false
            referencedRelation: "jovem_duplas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_especialista_desejado_id_fkey"
            columns: ["especialista_desejado_id"]
            isOneToOne: false
            referencedRelation: "jovem_especialistas"
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
            referencedRelation: "jovem_especialistas"
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
            referencedRelation: "jovem_perfil"
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
            referencedRelation: "mentorados_curriculo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_pessoal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_especialista_mentorado_id_fkey"
            columns: ["mentorado_id"]
            isOneToOne: false
            referencedRelation: "mentorados_turma"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      abrir_chamado: {
        Args: {
          p_assunto: string
          p_categoria: string
          p_descricao_outro?: string
          p_dupla_id?: string
          p_mensagem: string
        }
        Returns: Json
      }
      abrir_relatorio: {
        Args: {
          p_ip_hash: string
          p_senha: string
          p_slug: string
          p_ua: string
        }
        Returns: Json
      }
      aceitar_proposta: { Args: { p_id: string }; Returns: string }
      aceitar_solicitacao: {
        Args: { p_id: string; p_slot?: string }
        Returns: string
      }
      acrescentar_info_chamado: {
        Args: { p_id: string; p_texto: string }
        Returns: undefined
      }
      agendar_encontro_mentorado: {
        Args: {
          p_data_hora: string
          p_dupla: string
          p_link?: string
          p_motivo?: string
          p_numero: number
        }
        Returns: Json
      }
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
      assumir_chamado: { Args: { p_id: string }; Returns: undefined }
      atribuir_chamado: {
        Args: { p_id: string; p_para: string }
        Returns: undefined
      }
      atualizar_tentativa_registro: {
        Args: { p_etapas?: Json; p_id: string }
        Returns: undefined
      }
      avaliacao_esp_da_dupla: { Args: { p_dupla: string }; Returns: Json }
      avaliacao_media_dpp: { Args: { p_dupla_id: string }; Returns: Json }
      avaliacao_por_token: { Args: { p_token: string }; Returns: Json }
      cancelar_solicitacao: { Args: { p_id: string }; Returns: undefined }
      chamado_evento: {
        Args: { p_chamado: string; p_texto: string }
        Returns: undefined
      }
      chamado_notifica_autor: {
        Args: {
          p_chamado: string
          p_corpo: string
          p_tipo: string
          p_titulo: string
        }
        Returns: undefined
      }
      chamado_notifica_equipe: {
        Args: {
          p_autor?: string
          p_chamado: string
          p_corpo: string
          p_tipo: string
          p_titulo: string
        }
        Returns: undefined
      }
      chamado_visivel_equipe: {
        Args: { p_chamado: Database["public"]["Tables"]["chamados"]["Row"] }
        Returns: boolean
      }
      civis_btrim: { Args: { d: Json }; Returns: Json }
      comentar_chamado: {
        Args: { p_id: string; p_mencionados?: string[]; p_texto: string }
        Returns: undefined
      }
      concluir_tentativa_registro: {
        Args: { p_duracao_ms: number; p_id: string; p_registro: string }
        Returns: undefined
      }
      confirmar_sugestao_especialista: {
        Args: {
          p_demanda?: string
          p_especialista_id?: string
          p_id: string
          p_objetivo?: string
        }
        Returns: undefined
      }
      conflito_encontro: {
        Args: { p_data_hora: string; p_dupla: string }
        Returns: Json
      }
      contra_propor_solicitacao: {
        Args: { p_id: string; p_mensagem?: string; p_slot: string }
        Returns: undefined
      }
      criar_relatorio_link: {
        Args: {
          p_config: Json
          p_sem_senha?: boolean
          p_senha?: string
          p_titulo: string
          p_validade?: string
        }
        Returns: Json
      }
      dados_civis_ok: {
        Args: { com_parentesco?: boolean; d: Json }
        Returns: boolean
      }
      definir_visibilidade_avaliacao: {
        Args: { p_id: string; p_visivel: boolean }
        Returns: Json
      }
      desfecho_agregado: { Args: { p_cronograma?: string }; Returns: Json }
      desfecho_elegiveis_6m: { Args: never; Returns: Json }
      desmarcar_encontro: { Args: { p_encontro: string }; Returns: Json }
      devolver_chamado_fila: { Args: { p_id: string }; Returns: undefined }
      dispensar_sugestao_especialista: {
        Args: { p_id: string }
        Returns: undefined
      }
      disponibilidade_ok: { Args: { d: Json }; Returns: boolean }
      eh_equipe: { Args: never; Returns: boolean }
      email_disponivel: { Args: { p_email: string }; Returns: boolean }
      emitir_avaliacao_esp: {
        Args: { p_dupla: string; p_mentor: string }
        Returns: undefined
      }
      emitir_desfecho_6m_lote: {
        Args: { p_dupla_ids: string[] }
        Returns: Json
      }
      emitir_desfecho_core: {
        Args: {
          p_created_by: string
          p_dupla_id: string
          p_momento: string
          p_origem?: string
        }
        Returns: Json
      }
      emitir_instrumento_core: {
        Args: {
          p_created_by: string
          p_dupla_id: string
          p_origem?: string
          p_sistema: string
        }
        Returns: Json
      }
      emitir_instrumento_lote: {
        Args: { p_dupla_ids: string[]; p_sistema: string }
        Returns: Json
      }
      emitir_link_instrumento: {
        Args: { p_dupla_id: string; p_sistema: string }
        Returns: Json
      }
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
      enviar_lembrete: {
        Args: {
          p_corpo?: string
          p_destino?: string
          p_dupla_id: string
          p_href?: string
          p_titulo?: string
        }
        Returns: Json
      }
      especialista_slot_livre: {
        Args: { p_especialista: string; p_inicio: string }
        Returns: boolean
      }
      especialista_slots_livres: {
        Args: { p_ate?: string; p_desde?: string; p_especialista: string }
        Returns: {
          inicio: string
        }[]
      }
      falhar_login_handoff: { Args: { p_nonce: string }; Returns: undefined }
      form_anexo_put: {
        Args: {
          p_campo_id: string
          p_mime: string
          p_nome: string
          p_tamanho: number
          p_token: string
        }
        Returns: Json
      }
      formulario_por_token: { Args: { p_token: string }; Returns: Json }
      formularios_limpa_respostas: {
        Args: { p_campos: Json; p_link_id: string; p_respostas: Json }
        Returns: Json
      }
      gerar_senha_relatorio: { Args: never; Returns: string }
      gravar_saude_snapshots: { Args: { p_rows: Json }; Returns: number }
      has_papel:
        | {
            Args: {
              p_escopo_turma?: string
              p_papel: Database["public"]["Enums"]["app_role"]
            }
            Returns: boolean
          }
        | {
            Args: {
              p_escopo_turma?: string
              p_papel: Database["public"]["Enums"]["app_role"]
              p_profile_id: string
            }
            Returns: boolean
          }
      importar_registros: { Args: { itens: Json }; Returns: Json }
      iniciar_tentativa_registro: {
        Args: {
          p_dispositivo: string
          p_dupla: string
          p_encontro: string
          p_origem: string
        }
        Returns: string
      }
      instrumentos_da_dupla: { Args: { p_dupla_id: string }; Returns: Json }
      interesses_ok: { Args: { interesses: string[] }; Returns: boolean }
      jornada_autoemit: { Args: { p_dupla_id: string }; Returns: undefined }
      jovem_jornada: { Args: never; Returns: Json }
      jovem_relacionado: { Args: { p_profile: string }; Returns: boolean }
      marcar_aconteceu_mentorado: {
        Args: { p_encontro: string }
        Returns: Json
      }
      marcar_combinado: {
        Args: { p_feito: boolean; p_id: string }
        Returns: undefined
      }
      marcar_nao_aconteceu_mentorado: {
        Args: { p_encontro: string }
        Returns: Json
      }
      match_ia_chunks: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          guia: string
          pagina: number
          score: number
          secao: string
          trecho: string
        }[]
      }
      meus_dados_civis: { Args: never; Returns: Json }
      meus_dados_pessoais: { Args: never; Returns: Json }
      my_mentorado_id: { Args: never; Returns: string }
      my_papeis: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      my_profile_id: { Args: never; Returns: string }
      my_role: { Args: never; Returns: Database["public"]["Enums"]["app_role"] }
      nome_proprio: { Args: { p: string }; Returns: string }
      normalizar_disponibilidade: { Args: { d: Json }; Returns: Json }
      painel_instrumentos_jornada: { Args: never; Returns: Json }
      par_de_mim: { Args: { p_profile: string }; Returns: boolean }
      pdm_da_dupla: { Args: { p_dupla_id: string }; Returns: Json }
      pdm_parse_submetas: { Args: { p_texto: string }; Returns: string[] }
      pdm_pode_editar: { Args: { p_dupla_id: string }; Returns: boolean }
      pdm_projeta_resposta: {
        Args: { p_dupla_id: string; p_respostas: Json; p_sistema: string }
        Returns: undefined
      }
      pdm_remover_item: {
        Args: { p_dupla_id: string; p_item_id: string }
        Returns: undefined
      }
      pdm_reordenar: {
        Args: { p_dupla_id: string; p_item_ids: string[]; p_parent_id: string }
        Returns: undefined
      }
      pdm_salvar_item: {
        Args: {
          p_area_vida: string
          p_dupla_id: string
          p_indicador: string
          p_item_id: string
          p_parent_id: string
          p_porque: string
          p_prazo_alvo: string
          p_titulo: string
        }
        Returns: string
      }
      pdm_salvar_visao: {
        Args: { p_dupla_id: string; p_visao: string }
        Returns: undefined
      }
      pdm_status_item: {
        Args: { p_dupla_id: string; p_item_id: string; p_status: string }
        Returns: undefined
      }
      pedir_especialista_jovem: {
        Args: {
          p_demanda?: string
          p_especialista_id?: string
          p_motivo?: string
          p_slot?: string
        }
        Returns: string
      }
      pedir_reabertura_chamado: { Args: { p_id: string }; Returns: undefined }
      pegar_login_handoff: { Args: { p_nonce: string }; Returns: Json }
      postar_devolutiva: {
        Args: { p_dupla_id: string; p_texto: string }
        Returns: string
      }
      processar_lembretes_registro: {
        Args: { p_agora?: string }
        Returns: Json
      }
      processar_lembretes_trilha: { Args: { p_hoje?: string }; Returns: Json }
      promover_mentorado_mentor: {
        Args: {
          p_mentorado_id: string
          p_obs?: string
          p_papel: Database["public"]["Enums"]["app_role"]
          p_turma?: string
        }
        Returns: string
      }
      publicar_atualizacao_chamado: {
        Args: { p_id: string; p_texto: string }
        Returns: Json
      }
      reabrir_chamado: { Args: { p_id: string }; Returns: undefined }
      reconhecer_solicitacao: {
        Args: { p_id: string; p_turma?: string }
        Returns: undefined
      }
      recusar_solicitacao: {
        Args: { p_id: string; p_justificativa: string }
        Returns: undefined
      }
      redefinir_senha_relatorio_link: { Args: { p_id: string }; Returns: Json }
      reemitir_convite_terceiro: {
        Args: { p_contato_id: string }
        Returns: Json
      }
      regenerar_token_assinatura: { Args: { p_id: string }; Returns: string }
      registrar_email_apoio_avaliacao: {
        Args: {
          p_assunto: string
          p_avaliacao_id: string
          p_destinatarios: number
          p_enviados: number
          p_falhas?: string[]
        }
        Returns: Json
      }
      registrar_email_chamado: {
        Args: {
          p_assunto: string
          p_chamado_id: string
          p_destinatarios: number
          p_enviados: number
          p_falhas: string[]
        }
        Returns: undefined
      }
      registrar_ia_evento: {
        Args: {
          p_args: Json
          p_canal: string
          p_duracao_ms?: number
          p_erro?: string
          p_ok: boolean
          p_tool: string
        }
        Returns: string
      }
      registrar_login_handoff: {
        Args: { p_access: string; p_nonce: string; p_refresh: string }
        Returns: undefined
      }
      relatorio_link_info: { Args: { p_slug: string }; Returns: Json }
      relatorio_links_stats: { Args: never; Returns: Json }
      rematch_dupla: {
        Args: {
          p_devolutiva?: string
          p_dupla_id: string
          p_lado: string
          p_motivo?: string
          p_novo_id: string
          p_registrar_nota?: boolean
        }
        Returns: string
      }
      resolver_chamado: {
        Args: { p_id: string; p_resumo: string }
        Returns: undefined
      }
      resolver_chamado_por_origem: {
        Args: {
          p_avaliacao_id?: string
          p_registro_id?: string
          p_resumo?: string
        }
        Returns: undefined
      }
      resumo_log_acesso: {
        Args: {
          p_ip_hash: string
          p_link_id: string
          p_motivo: string
          p_ok: boolean
          p_params: Json
          p_slug: string
          p_ua: string
        }
        Returns: boolean
      }
      revogar_assinatura: { Args: { p_id: string }; Returns: undefined }
      revogar_relatorio_link: { Args: { p_id: string }; Returns: Json }
      salvar_consolidado_terceiros: {
        Args: {
          p_consolidado: string
          p_dupla_id: string
          p_publicar?: boolean
        }
        Returns: Json
      }
      set_contato_compartilhado: {
        Args: { p_ligado: boolean }
        Returns: undefined
      }
      set_disponibilidade_mentorado: {
        Args: { p_grade: Json }
        Returns: undefined
      }
      sol_coords: { Args: never; Returns: string[] }
      sol_efetivar: {
        Args: { p_esp: string; p_slot: string; p_sol: string }
        Returns: string
      }
      sol_notificar: {
        Args: {
          p_corpo: string
          p_href: string
          p_profile: string
          p_tipo: string
          p_titulo: string
        }
        Returns: undefined
      }
      submeter_avaliacao: {
        Args: {
          p_avancei?: string
          p_comentario?: string
          p_encontro_id: string
          p_estrelas: number
          p_pedir_apoio?: boolean
          p_sentimento?: string
          p_temas?: string[]
          p_token: string
          p_visivel_mentor?: boolean
        }
        Returns: Json
      }
      submeter_resposta_formulario: {
        Args: { p_respostas: Json; p_token: string }
        Returns: string
      }
      submeter_resposta_terceiro: {
        Args: { p_a_melhorar: string; p_pontos_fortes: string; p_token: string }
        Returns: Json
      }
      sugerir_especialista_mentor: {
        Args: {
          p_demanda: string
          p_especialista_id?: string
          p_mentorado_id: string
          p_objetivo?: string
        }
        Returns: string
      }
      supervisiona_dupla: { Args: { p_dupla: string }; Returns: boolean }
      terceiro_por_token: { Args: { p_token: string }; Returns: Json }
      trilha_do_jovem: { Args: { p_dupla_dpp_id: string }; Returns: Json }
    }
    Enums: {
      app_role:
        | "coordenacao"
        | "supervisor"
        | "mentor_dpp"
        | "mentor_especialista"
        | "mentorado"
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
        "mentorado",
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

