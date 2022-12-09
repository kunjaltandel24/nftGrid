import axios from "axios";
import { Contract, ContractInterface } from "ethers";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import CreateGridBtn from "./CreateGridBtn";
import ForkItBtn from "./ForkItBtn";
import COLLECTION_ABI from "../contracts/collection_abi.json";
import { Collection_abi } from '../contracts/types';

function Card(props: {
  collection: string
  baseURI?: string
  M?: string
  N?: string
  Name?: string
  Symbol?: string
}) {
  const { collection, baseURI, M, N, Name, Symbol } = props;
  const { address, connector } = useAccount();
  const [data, setData] = useState<any>({});
  const [refetchTrigger, setRefetchTrigger] = useState(false);
  const [coverImage, setCoverImage] = useState<string>();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [mints, setMints] = useState<any[]>([])

  const fetchMints = async () => {
    const resp = await axios.post('https://api.thegraph.com/subgraphs/name/yashthakor/grid-one', {
      query: `query Mints($collectionId: String!) {
        mints(where: { collection: $collectionId }) {
          id
          tokenId
          collection {
            id
          }
        }
      }`,
      extensions:{headers: null},
      operationName: 'Mints',
      variables: { collectionId: collection },
    });

    setMints(resp.data.data.mints);
  }

  useEffect(() => {
    if (Name) {
      return;
    }
    setLoading(true);
    (async () => {
      const signer = await connector?.getSigner();
      const collectionContract = new Contract(
        collection,
        COLLECTION_ABI as ContractInterface,
        signer
      );
      fetchMints()
          .catch((error) => console.error('failed to fetch mints: ', error));
      const M = (await collectionContract.M()).toString();
      const N = (await collectionContract.N()).toString();
      const owner = await collectionContract.Owner();
      const parent = await collectionContract.Parent();
      const minted = await collectionContract.minted();
      const baseURI = await collectionContract.baseURI();

      const name = await collectionContract.name();
      const sym = await collectionContract.symbol();



      setData({ name, sym, M, N, owner, parent, minted, baseURI });
      setLoading(false);
    })();
  }, [collection, refetchTrigger]);

  const fetchAvailableMint = async () => {
    const signer = await connector?.getSigner();
    const collectionContract: Collection_abi = new Contract(
        collection,
        COLLECTION_ABI as ContractInterface,
        signer
    ) as Collection_abi;
    let mint: string | null;
    const maxMint = Number(data.M) * Number(data.N);
    for (let i = 0; i < maxMint; i += 1) {
      const mintJSON = await fetchFile(`${data.baseURI}/${i}.json`)
      if (mintJSON.key) {
        setCoverImage(`${data.baseURI}/${mintJSON.key}`);
        break;
      }
    }
  }

  const fetchFile = (url: string) => {
    return axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
        .then((resp) => {
          // setImageUrl once mint subgraph handler is fixed
          return resp.data
        })
        .catch((error) => {
          console.error('failed to fetch image meta: ', error)
          return null
        });
  };

  useEffect(() => {
    if (connector && data.M && data.N) {
      fetchAvailableMint()
    }
  }, [mints, data.M, data.N])

  return (
    <div
      className="my-2 border-2 rounded-md border-black
      hover:scale-105 duration-300 overflow-hidden
      shadow-[0_3px_10px_rgb(0,0,0,0.2)]"
    >
      <figure>
        <img
          src={loading ? "/loader.svg" : coverImage || "/logo.png"}
          className="cursor-pointer hover:scale-110 duration-300 w-full object-cover border-b-2 border-black"
          onClick={() => navigate(`/collection/${collection}`)}
        />

        <figcaption className="p-4">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl font-semibold">
              {(Name || data.name) ?? " - "}
            </span>{" "}
            <span className="font-mono">({(Symbol || data.sym) ?? " - "})</span>
          </div>
          <p className="mb-3">
            Size: {(M || data.M) ?? "-"} x {(N || data.N) ?? "-"}
          </p>

          {!data.name ? (
            "..."
          ) : data.minted ? (
            <ForkItBtn collection={collection} />
          ) : address === data.owner ? (
              <button
                className="retro-btn w-full"
                onClick={() => navigate(`/collection/${collection}`)}
              >
                Work&nbsp;on&nbsp;Grid
              </button>
          ) : (
            <code className="leading-5 text-xs text-error">
              Grid is not yet completed by the owner.
            </code>
          )}
        </figcaption>
      </figure>
    </div>
  );
}

export default Card;
